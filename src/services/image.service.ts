/**
 * Imagens das espécies (doc 01 §9, doc 03 §9, decisões D3 e D4).
 *
 * Fluxo de envio (D3), sem passar o arquivo por uma função da Vercel:
 *   1. createImageUpload: o servidor valida nome/tipo/tamanho declarados e gera
 *      uma URL assinada de envio para um caminho único da espécie.
 *   2. O navegador envia o arquivo direto para o Storage com essa URL.
 *   3. registerUploadedImage: o servidor baixa o arquivo enviado, confere
 *      tamanho e conteúdo real (assinatura) e só então cria o registro. Se o
 *      arquivo for inválido, ele é removido.
 */
import { isUuid } from '@/lib/ids';
import {
  buildImagePath,
  detectImageType,
  fileExtension,
  IMAGE_BUCKET,
  IMAGE_SIGNATURE_BYTES,
  isAllowedMimeType,
  MAX_IMAGE_BYTES,
  validateImageFile,
  type ImageMimeType,
} from '@/lib/images';
import { fail, failFromDatabase, failFromException, ok, type Result } from '@/lib/result';
import type { TypedSupabaseClient } from '@/lib/supabase/types';
import { imageMetadataSchema } from '@/lib/validation/media';
import { toFieldErrors } from '@/lib/validation/species';
import type { SpeciesImage } from '@/types/species';

import { IMAGE_COLUMNS, sortImages, toSpeciesImage } from './mappers';

export interface ImageUploadRequest {
  speciesId: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface ImageUploadTicket {
  imageId: string;
  path: string;
  /** Token da URL assinada, usado com storage.uploadToSignedUrl(path, token, file). */
  token: string;
  signedUrl: string;
}

/** Passo 1: valida o arquivo declarado e gera a URL assinada de envio. */
export async function createImageUpload(
  client: TypedSupabaseClient,
  request: ImageUploadRequest,
): Promise<Result<ImageUploadTicket>> {
  if (!isUuid(request.speciesId)) return fail('not_found', 'Espécie não encontrada.');

  const problems = validateImageFile({
    name: request.fileName,
    declaredType: request.mimeType,
    size: request.size,
  });
  if (problems.length > 0) return fail('invalid_file', problems.join(' '));

  try {
    const species = await client
      .from('species')
      .select('id')
      .eq('id', request.speciesId)
      .maybeSingle();
    if (species.error) return failFromDatabase(species.error);
    if (!species.data) return fail('not_found', 'Espécie não encontrada.');

    const imageId = crypto.randomUUID();
    const path = buildImagePath(request.speciesId, imageId, request.mimeType as ImageMimeType);
    const { data, error } = await client.storage.from(IMAGE_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      return fail(
        'forbidden',
        'Não foi possível autorizar o envio da imagem. Verifique sua permissão.',
      );
    }
    return ok({ imageId, path: data.path, token: data.token, signedUrl: data.signedUrl });
  } catch (exception) {
    return failFromException(exception);
  }
}

export interface RegisterImageRequest {
  speciesId: string;
  imageId: string;
  /** Tipo do arquivo informado no passo 1. */
  mimeType: string;
  metadata: unknown;
}

async function removeQuietly(client: TypedSupabaseClient, path: string): Promise<boolean> {
  try {
    const { error } = await client.storage.from(IMAGE_BUCKET).remove([path]);
    return !error;
  } catch {
    return false;
  }
}

/** Passo 3: confere o arquivo enviado e cria o registro da imagem. */
export async function registerUploadedImage(
  client: TypedSupabaseClient,
  request: RegisterImageRequest,
): Promise<Result<SpeciesImage>> {
  if (!isUuid(request.speciesId) || !isUuid(request.imageId)) {
    return fail('not_found', 'Imagem não encontrada.');
  }
  if (!isAllowedMimeType(request.mimeType)) {
    return fail('invalid_file', 'Formato não permitido. Use WebP, JPEG ou PNG.');
  }

  const metadata = imageMetadataSchema.safeParse(request.metadata);
  if (!metadata.success) {
    return fail('validation', 'Confira os dados da imagem.', {
      fieldErrors: toFieldErrors(metadata.error),
    });
  }

  // O caminho é recalculado no servidor; nunca vem do cliente (doc 03 §4.2).
  const path = buildImagePath(request.speciesId, request.imageId, request.mimeType);

  try {
    const download = await client.storage.from(IMAGE_BUCKET).download(path);
    if (download.error || !download.data) {
      return fail('not_found', 'O arquivo enviado não foi encontrado. Envie a imagem novamente.');
    }

    const blob = download.data;
    const head = new Uint8Array(await blob.slice(0, IMAGE_SIGNATURE_BYTES).arrayBuffer());
    const problems = validateImageFile({
      name: `arquivo.${fileExtension(path)}`,
      declaredType: request.mimeType,
      size: blob.size,
      head,
    });
    if (blob.size > MAX_IMAGE_BYTES || detectImageType(head) !== request.mimeType) {
      if (problems.length === 0)
        problems.push('O arquivo enviado não corresponde ao formato informado.');
    }
    if (problems.length > 0) {
      await removeQuietly(client, path);
      return fail('invalid_file', problems.join(' '));
    }

    // Próxima posição na galeria.
    const last = await client
      .from('species_images')
      .select('display_order')
      .eq('species_id', request.speciesId)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last.error) {
      await removeQuietly(client, path);
      return failFromDatabase(last.error);
    }

    const { data, error } = await client
      .from('species_images')
      .insert({
        id: request.imageId,
        species_id: request.speciesId,
        storage_path: path,
        alt_text: metadata.data.altText,
        caption: metadata.data.caption,
        credit: metadata.data.credit,
        license: metadata.data.license,
        source_url: metadata.data.sourceUrl,
        is_cover: false,
        display_order: last.data ? last.data.display_order + 1 : 0,
      })
      .select(IMAGE_COLUMNS)
      .single();

    if (error) {
      // Evita arquivo órfão quando o registro não pôde ser criado.
      await removeQuietly(client, path);
      return failFromDatabase(error);
    }
    return ok(toSpeciesImage(client, data));
  } catch (exception) {
    return failFromException(exception);
  }
}

/** Imagens de uma espécie na ordem do painel. */
export async function listSpeciesImages(
  client: TypedSupabaseClient,
  speciesId: string,
): Promise<Result<SpeciesImage[]>> {
  if (!isUuid(speciesId)) return ok([]);
  try {
    const { data, error } = await client
      .from('species_images')
      .select(IMAGE_COLUMNS)
      .eq('species_id', speciesId);
    if (error) return failFromDatabase(error);
    return ok(sortImages((data ?? []).map((row) => toSpeciesImage(client, row))));
  } catch (exception) {
    return failFromException(exception);
  }
}

/** Atualiza texto alternativo, legenda e créditos. */
export async function updateImageMetadata(
  client: TypedSupabaseClient,
  imageId: string,
  input: unknown,
): Promise<Result<SpeciesImage>> {
  if (!isUuid(imageId)) return fail('not_found', 'Imagem não encontrada.');
  const metadata = imageMetadataSchema.safeParse(input);
  if (!metadata.success) {
    return fail('validation', 'Confira os dados da imagem.', {
      fieldErrors: toFieldErrors(metadata.error),
    });
  }
  try {
    const { data, error } = await client
      .from('species_images')
      .update({
        alt_text: metadata.data.altText,
        caption: metadata.data.caption,
        credit: metadata.data.credit,
        license: metadata.data.license,
        source_url: metadata.data.sourceUrl,
      })
      .eq('id', imageId)
      .select(IMAGE_COLUMNS)
      .maybeSingle();
    if (error) return failFromDatabase(error);
    if (!data) return fail('not_found', 'Imagem não encontrada.');
    return ok(toSpeciesImage(client, data));
  } catch (exception) {
    return failFromException(exception);
  }
}

/** Define a capa; a anterior deixa de ser capa no mesmo comando (doc 03 §9.3). */
export async function setCoverImage(
  client: TypedSupabaseClient,
  imageId: string,
): Promise<Result<{ imageId: string }>> {
  if (!isUuid(imageId)) return fail('not_found', 'Imagem não encontrada.');
  try {
    const { error } = await client.rpc('set_species_cover', { p_image_id: imageId });
    if (error) return failFromDatabase(error);
    return ok({ imageId });
  } catch (exception) {
    return failFromException(exception);
  }
}

/** Reordena a galeria. `orderedIds` deve conter exatamente as imagens da espécie. */
export async function reorderImages(
  client: TypedSupabaseClient,
  speciesId: string,
  orderedIds: string[],
): Promise<Result<{ speciesId: string }>> {
  if (!isUuid(speciesId) || !orderedIds.every(isUuid)) {
    return fail('validation', 'Ordem de imagens inválida.');
  }
  try {
    const current = await client.from('species_images').select('id').eq('species_id', speciesId);
    if (current.error) return failFromDatabase(current.error);

    const currentIds = new Set((current.data ?? []).map((row) => row.id));
    const sameSet =
      currentIds.size === orderedIds.length &&
      new Set(orderedIds).size === orderedIds.length &&
      orderedIds.every((id) => currentIds.has(id));
    if (!sameSet) {
      return fail('validation', 'A lista de imagens mudou. Recarregue a página e tente de novo.');
    }

    for (const [index, id] of orderedIds.entries()) {
      const { error } = await client
        .from('species_images')
        .update({ display_order: index })
        .eq('id', id)
        .eq('species_id', speciesId);
      if (error) return failFromDatabase(error);
    }
    return ok({ speciesId });
  } catch (exception) {
    return failFromException(exception);
  }
}

export interface DeleteImageResult {
  imageId: string;
  /** Caminho que não pôde ser apagado do Storage, se houver. */
  orphanedFile: string | null;
}

/**
 * Remove o registro e depois o arquivo. Se a imagem for a capa de uma espécie
 * publicada, o banco bloqueia (mudança aprovada 5) e nada é apagado.
 */
export async function deleteImage(
  client: TypedSupabaseClient,
  imageId: string,
): Promise<Result<DeleteImageResult>> {
  if (!isUuid(imageId)) return fail('not_found', 'Imagem não encontrada.');
  try {
    const { data, error } = await client
      .from('species_images')
      .delete()
      .eq('id', imageId)
      .select('storage_path')
      .maybeSingle();
    if (error) return failFromDatabase(error);
    if (!data) return fail('not_found', 'Imagem não encontrada ou sem permissão para excluir.');

    const removed = await removeQuietly(client, data.storage_path);
    return ok({ imageId, orphanedFile: removed ? null : data.storage_path });
  } catch (exception) {
    return failFromException(exception);
  }
}
