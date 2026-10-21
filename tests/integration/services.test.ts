/**
 * Serviços contra um Supabase real (local, no CI): RLS, regras do banco,
 * Storage e o fluxo completo rascunho → imagem → publicação → exclusão.
 * Todos os dados são fictícios e removidos ao final.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { IMAGE_BUCKET } from '@/lib/images';
import type { TypedSupabaseClient } from '@/lib/supabase/types';
import {
  createImageUpload,
  deleteImage,
  listSpeciesImages,
  registerUploadedImage,
  setCoverImage,
} from '@/services/image.service';
import { addSource } from '@/services/source.service';
import {
  createSpeciesDraft,
  deleteSpecies,
  getPublicationIssues,
  getPublishedSpeciesBySlug,
  getSpeciesForEdit,
  listAdminSpecies,
  listGroupsWithPublishedSpecies,
  listPublishedSpecies,
  publishSpecies,
  unpublishSpecies,
  updateSpecies,
} from '@/services/species.service';

import {
  anonClient,
  createTestUser,
  deleteTestUser,
  hasIntegrationEnv,
  RUN_PREFIX,
  serviceClient,
  TINY_PNG,
  type TestUser,
} from './helpers';

const base = {
  commonName: 'Tubarão de integração',
  scientificName: `Fictitia integrationis ${RUN_PREFIX}`,
  slug: `${RUN_PREFIX}-tubarao`,
  displayGroup: 'outros',
};

async function upload(
  client: TypedSupabaseClient,
  speciesId: string,
  bytes: Uint8Array<ArrayBuffer>,
  mimeType: string,
) {
  const ticket = await createImageUpload(client, {
    speciesId,
    fileName: mimeType === 'image/png' ? 'imagem.png' : 'imagem.jpg',
    mimeType,
    size: bytes.byteLength,
  });
  if (!ticket.ok) return ticket;
  const sent = await client.storage
    .from(IMAGE_BUCKET)
    .uploadToSignedUrl(ticket.data.path, ticket.data.token, new Blob([bytes], { type: mimeType }), {
      contentType: mimeType,
    });
  expect(sent.error).toBeNull();
  return ticket;
}

async function filesOf(client: TypedSupabaseClient, speciesId: string): Promise<string[]> {
  const { data, error } = await client.storage.from(IMAGE_BUCKET).list(`species/${speciesId}`);
  expect(error).toBeNull();
  return (data ?? []).map((file) => file.name);
}

describe.skipIf(!hasIntegrationEnv)('serviços contra o Supabase local', () => {
  let admin: TestUser;
  let comum: TestUser;
  const anon = hasIntegrationEnv ? anonClient() : (undefined as unknown as TypedSupabaseClient);
  let speciesId = '';
  let imageId = '';

  beforeAll(async () => {
    admin = await createTestUser('admin', { admin: true });
    comum = await createTestUser('comum', { admin: false });
  });

  afterAll(async () => {
    if (!hasIntegrationEnv) return;
    const service = serviceClient();
    const leftovers = await service.from('species').select('id').like('slug', `${RUN_PREFIX}%`);
    for (const row of leftovers.data ?? []) {
      const files = await service.storage.from(IMAGE_BUCKET).list(`species/${row.id}`);
      const paths = (files.data ?? []).map((file) => `species/${row.id}/${file.name}`);
      if (paths.length > 0) await service.storage.from(IMAGE_BUCKET).remove(paths);
      await service.from('species').delete().eq('id', row.id);
    }
    await deleteTestUser(admin);
    await deleteTestUser(comum);
  });

  // -------------------------------------------------------------------------
  // Rascunho e duplicidade
  // -------------------------------------------------------------------------

  it('administrador cria rascunho', async () => {
    const result = await createSpeciesDraft(admin.client, base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    speciesId = result.data.id;
    expect(result.data.slug).toBe(base.slug);
  });

  it('rascunho não aparece para visitantes, nem pelo slug', async () => {
    const bySlug = await getPublishedSpeciesBySlug(anon, base.slug);
    expect(bySlug).toEqual({ ok: true, data: null });

    const list = await listPublishedSpecies(anon, { q: 'integração' });
    expect(list.ok && list.data.items.some((item) => item.id === speciesId)).toBe(false);
  });

  it('rascunho aparece no painel do administrador', async () => {
    const list = await listAdminSpecies(admin.client, {
      q: 'tubarao de integracao',
      status: 'draft',
    });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const item = list.data.items.find((row) => row.id === speciesId);
    expect(item).toMatchObject({ isPublished: false, hasCover: false });
  });

  it('slug repetido é recusado com mensagem clara', async () => {
    const result = await createSpeciesDraft(admin.client, {
      ...base,
      scientificName: 'Fictitia alia',
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('slug_taken');
  });

  it('nome científico repetido gera aviso e só salva com confirmação', async () => {
    const duplicate = {
      ...base,
      slug: `${RUN_PREFIX}-duplicado`,
      scientificName: `  FICTITIA   integrationis ${RUN_PREFIX} `,
    };
    const warned = await createSpeciesDraft(admin.client, duplicate);
    expect(warned.ok).toBe(false);
    if (warned.ok) return;
    expect(warned.error.code).toBe('duplicate_scientific_name');
    expect(warned.error.matches?.map((match) => match.id)).toContain(speciesId);

    const confirmed = await createSpeciesDraft(admin.client, duplicate, {
      confirmDuplicateName: true,
    });
    expect(confirmed.ok).toBe(true);
  });

  it('identificador WoRMS repetido é bloqueado', async () => {
    const first = await createSpeciesDraft(admin.client, {
      ...base,
      slug: `${RUN_PREFIX}-worms-1`,
      scientificName: `Fictitia vermis ${RUN_PREFIX}`,
      wormsAphiaId: 900_000_001,
    });
    expect(first.ok).toBe(true);
    const second = await createSpeciesDraft(admin.client, {
      ...base,
      slug: `${RUN_PREFIX}-worms-2`,
      scientificName: `Fictitia vermis secunda ${RUN_PREFIX}`,
      wormsAphiaId: 900_000_001,
    });
    expect(!second.ok && second.error.code).toBe('worms_id_taken');
  });

  it('usuário sem permissão não cria espécie', async () => {
    const result = await createSpeciesDraft(comum.client, {
      ...base,
      slug: `${RUN_PREFIX}-invasor`,
    });
    expect(!result.ok && result.error.code).toBe('forbidden');
  });

  it('dados inválidos voltam com erros por campo', async () => {
    const result = await createSpeciesDraft(admin.client, {
      ...base,
      commonName: '  ',
      slug: 'Slug Errado',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    expect(Object.keys(result.error.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(['commonName', 'slug']),
    );
  });

  // -------------------------------------------------------------------------
  // Publicação e imagens
  // -------------------------------------------------------------------------

  it('publicar sem capa e sem descrição é bloqueado com a lista do que falta', async () => {
    const issues = await getPublicationIssues(admin.client, speciesId);
    expect(issues).toEqual({ ok: true, data: ['missing_cover', 'missing_description'] });

    const result = await publishSpecies(admin.client, speciesId);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.issues).toEqual(['missing_cover', 'missing_description']);
  });

  it('envia imagem PNG válida pelo fluxo de URL assinada', async () => {
    const ticket = await upload(admin.client, speciesId, TINY_PNG, 'image/png');
    expect(ticket.ok).toBe(true);
    if (!ticket.ok) return;
    imageId = ticket.data.imageId;

    const registered = await registerUploadedImage(admin.client, {
      speciesId,
      imageId,
      mimeType: 'image/png',
      metadata: { altText: 'Imagem fictícia de teste', credit: 'Equipe de testes' },
    });
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    expect(registered.data.isCover).toBe(false);
    expect(registered.data.url).toContain(`species/${speciesId}/${imageId}.png`);
    expect(await filesOf(admin.client, speciesId)).toEqual([`${imageId}.png`]);
  });

  it('arquivo de texto disfarçado de PNG é recusado e removido do Storage', async () => {
    const fake = new TextEncoder().encode('isto não é uma imagem, apenas texto de teste');
    const ticket = await upload(admin.client, speciesId, fake, 'image/png');
    expect(ticket.ok).toBe(true);
    if (!ticket.ok) return;

    const registered = await registerUploadedImage(admin.client, {
      speciesId,
      imageId: ticket.data.imageId,
      mimeType: 'image/png',
      metadata: { altText: 'Não deveria ser salva' },
    });
    expect(!registered.ok && registered.error.code).toBe('invalid_file');
    expect(await filesOf(admin.client, speciesId)).toEqual([`${imageId}.png`]);

    const images = await listSpeciesImages(admin.client, speciesId);
    expect(images.ok && images.data.map((image) => image.id)).toEqual([imageId]);
  });

  it('usuário sem permissão não consegue autorizar envio de imagem', async () => {
    const ticket = await createImageUpload(comum.client, {
      speciesId,
      fileName: 'x.png',
      mimeType: 'image/png',
      size: TINY_PNG.byteLength,
    });
    expect(ticket.ok).toBe(false);
  });

  it('define capa, completa o resumo, registra fonte e publica', async () => {
    expect((await setCoverImage(admin.client, imageId)).ok).toBe(true);

    const updated = await updateSpecies(admin.client, speciesId, {
      ...base,
      shortDescription: 'Registro fictício criado pelos testes de integração.',
    });
    expect(updated.ok).toBe(true);

    const source = await addSource(admin.client, speciesId, {
      provider: 'manual',
      referenceTitle: 'Referência fictícia de teste',
      accessedAt: '2026-10-01',
      fieldsImported: ['short_description'],
    });
    expect(source.ok).toBe(true);

    const published = await publishSpecies(admin.client, speciesId);
    expect(published.ok).toBe(true);
  });

  it('visitante encontra a espécie publicada pesquisando sem acento', async () => {
    const list = await listPublishedSpecies(anon, { q: '  TUBARAO de INTEGRACAO ' });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const item = list.data.items.find((row) => row.id === speciesId);
    expect(item?.cover?.id).toBe(imageId);
    expect(item?.group).toEqual({ slug: 'outros', label: 'Outros' });

    const scientific = await listPublishedSpecies(anon, { q: `integrationis ${RUN_PREFIX}` });
    expect(scientific.ok && scientific.data.items.map((row) => row.id)).toContain(speciesId);
  });

  it('página da espécie traz imagens, fontes e campos vazios como null', async () => {
    const detail = await getPublishedSpeciesBySlug(anon, base.slug);
    expect(detail.ok).toBe(true);
    if (!detail.ok || !detail.data) throw new Error('espécie publicada não encontrada');
    expect(detail.data.cover?.altText).toBe('Imagem fictícia de teste');
    expect(detail.data.images).toHaveLength(1);
    expect(detail.data.sources.map((source) => source.referenceTitle)).toEqual([
      'Referência fictícia de teste',
    ]);
    expect(detail.data.habitat).toBeNull();
    expect(detail.data.diet).toBeNull();
    expect(detail.data.conservation).toBeNull();
  });

  it('o filtro de grupos só traz grupos com espécies publicadas', async () => {
    const groups = await listGroupsWithPublishedSpecies(anon);
    expect(groups.ok).toBe(true);
    if (!groups.ok) return;
    expect(groups.data).toContainEqual({ slug: 'outros', label: 'Outros' });
    expect(groups.data.map((group) => group.slug)).not.toContain('cnidarios');
  });

  it('caracteres especiais e páginas além do fim não quebram a pesquisa', async () => {
    const special = await listPublishedSpecies(anon, { q: '%_\\\'"(),' });
    expect(special).toMatchObject({ ok: true, data: { items: [] } });

    const beyond = await listPublishedSpecies(anon, { page: 9_999 });
    expect(beyond).toMatchObject({ ok: true, data: { items: [] } });
  });

  it('excluir a capa de uma espécie publicada é bloqueado e o arquivo permanece', async () => {
    const result = await deleteImage(admin.client, imageId);
    expect(!result.ok && result.error.code).toBe('not_publishable');
    expect(await filesOf(admin.client, speciesId)).toEqual([`${imageId}.png`]);
  });

  it('usuário sem permissão não altera espécie publicada', async () => {
    const result = await updateSpecies(comum.client, speciesId, {
      ...base,
      commonName: 'Alterado',
    });
    expect(result.ok).toBe(false);
    const detail = await getSpeciesForEdit(admin.client, speciesId);
    expect(detail.ok && detail.data?.commonName).toBe(base.commonName);
  });

  it('retirar a publicação remove a espécie do site', async () => {
    expect((await unpublishSpecies(admin.client, speciesId)).ok).toBe(true);
    expect(await getPublishedSpeciesBySlug(anon, base.slug)).toEqual({ ok: true, data: null });
  });

  // -------------------------------------------------------------------------
  // Exclusão coordenada (banco + Storage)
  // -------------------------------------------------------------------------

  it('excluir a espécie remove registros e arquivos do Storage', async () => {
    const result = await deleteSpecies(admin.client, speciesId);
    expect(result).toEqual({
      ok: true,
      data: { id: speciesId, removedFiles: 1, orphanedFiles: [] },
    });

    expect(await filesOf(admin.client, speciesId)).toEqual([]);
    const gone = await getSpeciesForEdit(admin.client, speciesId);
    expect(gone).toEqual({ ok: true, data: null });
  });

  it('usuário sem permissão não exclui espécie', async () => {
    const created = await createSpeciesDraft(admin.client, {
      ...base,
      slug: `${RUN_PREFIX}-protegida`,
      scientificName: `Fictitia protecta ${RUN_PREFIX}`,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const result = await deleteSpecies(comum.client, created.data.id);
    expect(!result.ok && result.error.code).toBe('not_found');
    const still = await getSpeciesForEdit(admin.client, created.data.id);
    expect(still.ok && still.data?.id).toBe(created.data.id);
  });

  it('não existe cadastro público: visitantes não conseguem criar conta', async () => {
    const { data, error } = await anonClient().auth.signUp({
      email: `${RUN_PREFIX}-cadastro@teste.invalid`,
      password: `Senha-${crypto.randomUUID()}`,
    });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });
});
