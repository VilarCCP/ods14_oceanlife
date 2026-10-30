'use server';

/**
 * Ações do painel (decisão D5: Server Actions). Cada ação verifica sessão e
 * permissão de administrador no servidor antes de qualquer operação, e o
 * banco reforça tudo com RLS. Os dados chegam como `unknown` e são validados
 * pelos serviços com Zod — nada do cliente é confiado (doc 03 §4.2).
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireAdminAction } from '@/lib/auth';
import { safeAdminPath } from '@/lib/navigation';
import { fail, type Result } from '@/lib/result';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeText } from '@/lib/text';
import {
  createImageUpload,
  deleteImage,
  registerUploadedImage,
  reorderImages,
  setCoverImage,
  updateImageMetadata,
  type DeleteImageResult,
  type ImageUploadTicket,
} from '@/services/image.service';
import { addSource, deleteSource, updateSource } from '@/services/source.service';
import {
  createSpeciesDraft,
  deleteSpecies,
  getSpeciesCommonName,
  publishSpecies,
  unpublishSpecies,
  updateSpecies,
  type SaveOptions,
} from '@/services/species.service';
import type { SpeciesImage, SpeciesSource } from '@/types/species';

function refreshAdmin() {
  revalidatePath('/admin', 'layout');
}

// ---------------------------------------------------------------------------
// Login e logout
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.email({ error: 'Informe um e-mail válido.' }).max(320),
  password: z.string().min(1, { error: 'Informe a senha.' }).max(200),
});

export type LoginResult = { ok: false; message: string; fieldErrors?: Record<string, string[]> };

/**
 * Entra com e-mail e senha. A mensagem de falha é sempre a mesma, para não
 * revelar se um e-mail está cadastrado (doc 03 §4.1).
 */
export async function signInAction(input: unknown, next: unknown): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '_form');
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, message: 'Confira os campos destacados.', fieldErrors };
  }

  const client = await createSupabaseServerClient();
  let failure: LoginResult | null = null;
  try {
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error) {
      if (error.name === 'AuthRetryableFetchError') {
        failure = {
          ok: false,
          message: 'Não foi possível conectar ao serviço de login. Tente novamente.',
        };
      } else if (error.status === 429) {
        failure = {
          ok: false,
          message: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
        };
      } else {
        failure = { ok: false, message: 'E-mail ou senha incorretos.' };
      }
    }
  } catch {
    failure = {
      ok: false,
      message: 'Não foi possível conectar ao serviço de login. Tente novamente.',
    };
  }
  if (failure) return failure;

  refreshAdmin();
  // redirect() precisa ficar fora do try/catch.
  redirect(safeAdminPath(typeof next === 'string' ? next : null));
}

export async function signOutAction(): Promise<void> {
  const client = await createSupabaseServerClient();
  try {
    await client.auth.signOut();
  } catch {
    // Mesmo que o provedor falhe, os cookies locais são removidos pelo cliente.
  }
  refreshAdmin();
  redirect('/admin/login?saiu=1');
}

// ---------------------------------------------------------------------------
// Espécies
// ---------------------------------------------------------------------------

function saveOptions(options: unknown): SaveOptions {
  const parsed = z.object({ confirmDuplicateName: z.boolean().optional() }).safeParse(options);
  return parsed.success ? parsed.data : {};
}

export async function createSpeciesAction(
  input: unknown,
  options: unknown,
): Promise<Result<{ id: string; slug: string }>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  const result = await createSpeciesDraft(auth.data.client, input, saveOptions(options));
  if (result.ok) refreshAdmin();
  return result;
}

export async function updateSpeciesAction(
  id: unknown,
  input: unknown,
  options: unknown,
): Promise<Result<{ id: string; slug: string }>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  if (typeof id !== 'string') return fail('not_found', 'Espécie não encontrada.');
  const result = await updateSpecies(auth.data.client, id, input, saveOptions(options));
  if (result.ok) refreshAdmin();
  return result;
}

export async function publishSpeciesAction(id: unknown): Promise<Result<{ id: string }>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  if (typeof id !== 'string') return fail('not_found', 'Espécie não encontrada.');
  const result = await publishSpecies(auth.data.client, id);
  if (result.ok) refreshAdmin();
  return result;
}

export async function unpublishSpeciesAction(id: unknown): Promise<Result<{ id: string }>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  if (typeof id !== 'string') return fail('not_found', 'Espécie não encontrada.');
  const result = await unpublishSpecies(auth.data.client, id);
  if (result.ok) refreshAdmin();
  return result;
}

/**
 * Exclui a espécie. Exige que o nome popular seja digitado de novo, conferido
 * no servidor (doc 03 §13). Em caso de sucesso, volta para a lista.
 */
export async function deleteSpeciesAction(id: unknown, typedName: unknown): Promise<Result<never>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  if (typeof id !== 'string') return fail('not_found', 'Espécie não encontrada.');

  const current = await getSpeciesCommonName(auth.data.client, id);
  if (!current.ok) return current;
  if (current.data === null) return fail('not_found', 'Espécie não encontrada.');
  if (typeof typedName !== 'string' || normalizeText(typedName) !== normalizeText(current.data)) {
    return fail('validation', 'Digite o nome popular exatamente como aparece para confirmar.');
  }

  const result = await deleteSpecies(auth.data.client, id);
  if (!result.ok) return result;

  refreshAdmin();
  const orphaned = result.data.orphanedFiles.length;
  redirect(`/admin/especies?excluida=1${orphaned > 0 ? `&arquivos=${orphaned}` : ''}`);
}

// ---------------------------------------------------------------------------
// Imagens
// ---------------------------------------------------------------------------

export async function requestImageUploadAction(
  speciesId: unknown,
  file: unknown,
): Promise<Result<ImageUploadTicket>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  const parsed = z
    .object({
      fileName: z.string().min(1).max(255),
      mimeType: z.string().max(100),
      size: z.number().int().nonnegative(),
    })
    .safeParse(file);
  if (typeof speciesId !== 'string' || !parsed.success) {
    return fail('invalid_file', 'Dados do arquivo inválidos.');
  }
  return createImageUpload(auth.data.client, { speciesId, ...parsed.data });
}

export async function registerImageAction(
  speciesId: unknown,
  imageId: unknown,
  mimeType: unknown,
  metadata: unknown,
): Promise<Result<SpeciesImage>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  if (
    typeof speciesId !== 'string' ||
    typeof imageId !== 'string' ||
    typeof mimeType !== 'string'
  ) {
    return fail('invalid_file', 'Dados do arquivo inválidos.');
  }
  const result = await registerUploadedImage(auth.data.client, {
    speciesId,
    imageId,
    mimeType,
    metadata,
  });
  if (result.ok) refreshAdmin();
  return result;
}

export async function setCoverImageAction(imageId: unknown): Promise<Result<{ imageId: string }>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  if (typeof imageId !== 'string') return fail('not_found', 'Imagem não encontrada.');
  const result = await setCoverImage(auth.data.client, imageId);
  if (result.ok) refreshAdmin();
  return result;
}

export async function reorderImagesAction(
  speciesId: unknown,
  orderedIds: unknown,
): Promise<Result<{ speciesId: string }>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  const ids = z.array(z.string()).max(200).safeParse(orderedIds);
  if (typeof speciesId !== 'string' || !ids.success) {
    return fail('validation', 'Ordem de imagens inválida.');
  }
  const result = await reorderImages(auth.data.client, speciesId, ids.data);
  if (result.ok) refreshAdmin();
  return result;
}

export async function updateImageMetadataAction(
  imageId: unknown,
  metadata: unknown,
): Promise<Result<SpeciesImage>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  if (typeof imageId !== 'string') return fail('not_found', 'Imagem não encontrada.');
  const result = await updateImageMetadata(auth.data.client, imageId, metadata);
  if (result.ok) refreshAdmin();
  return result;
}

export async function deleteImageAction(imageId: unknown): Promise<Result<DeleteImageResult>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  if (typeof imageId !== 'string') return fail('not_found', 'Imagem não encontrada.');
  const result = await deleteImage(auth.data.client, imageId);
  if (result.ok) refreshAdmin();
  return result;
}

// ---------------------------------------------------------------------------
// Fontes
// ---------------------------------------------------------------------------

export async function addSourceAction(
  speciesId: unknown,
  input: unknown,
): Promise<Result<SpeciesSource>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  if (typeof speciesId !== 'string') return fail('not_found', 'Espécie não encontrada.');
  const result = await addSource(auth.data.client, speciesId, input);
  if (result.ok) refreshAdmin();
  return result;
}

export async function updateSourceAction(
  sourceId: unknown,
  input: unknown,
): Promise<Result<SpeciesSource>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  if (typeof sourceId !== 'string') return fail('not_found', 'Fonte não encontrada.');
  const result = await updateSource(auth.data.client, sourceId, input);
  if (result.ok) refreshAdmin();
  return result;
}

export async function deleteSourceAction(sourceId: unknown): Promise<Result<{ id: string }>> {
  const auth = await requireAdminAction();
  if (!auth.ok) return auth;
  if (typeof sourceId !== 'string') return fail('not_found', 'Fonte não encontrada.');
  const result = await deleteSource(auth.data.client, sourceId);
  if (result.ok) refreshAdmin();
  return result;
}
