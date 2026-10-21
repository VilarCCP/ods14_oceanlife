import { randomUUID } from 'node:crypto';

import { E2E_PREFIX, e2eServiceClient, fixtures, TINY_PNG } from './fixtures';
import globalTeardown from './global-teardown';

type Client = ReturnType<typeof e2eServiceClient>;

async function insertSpecies(
  client: Client,
  values: { slug: string; commonName: string; scientificName: string; group?: string },
  extra: Record<string, string | boolean | null> = {},
): Promise<string> {
  const { data, error } = await client
    .from('species')
    .insert({
      slug: values.slug,
      common_name: values.commonName,
      scientific_name: values.scientificName,
      display_group: values.group ?? null,
      ...extra,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Falha ao criar ${values.slug}: ${error.message}`);
  return data.id;
}

async function addImage(
  client: Client,
  speciesId: string,
  options: { cover: boolean; order: number; alt: string; credit?: string },
) {
  const imageId = randomUUID();
  const path = `species/${speciesId}/${imageId}.png`;
  const upload = await client.storage
    .from('species-images')
    .upload(path, TINY_PNG, { contentType: 'image/png' });
  if (upload.error) throw new Error(`Falha ao enviar imagem: ${upload.error.message}`);

  const { error } = await client.from('species_images').insert({
    id: imageId,
    species_id: speciesId,
    storage_path: path,
    alt_text: options.alt,
    credit: options.credit ?? null,
    is_cover: options.cover,
    display_order: options.order,
  });
  if (error) throw new Error(`Falha ao registrar imagem: ${error.message}`);
}

async function publish(client: Client, speciesId: string, featured = false) {
  const { error } = await client
    .from('species')
    .update({ is_published: true, is_featured: featured })
    .eq('id', speciesId);
  if (error) throw new Error(`Falha ao publicar: ${error.message}`);
}

export default async function globalSetup() {
  // Começa de um estado limpo, mesmo que uma execução anterior tenha falhado.
  await globalTeardown();
  const client = e2eServiceClient();

  const featured = await insertSpecies(client, fixtures.featured, {
    short_description: fixtures.featured.shortDescription,
    habitat: fixtures.featured.habitat,
  });
  await addImage(client, featured, {
    cover: true,
    order: 0,
    alt: 'Imagem fictícia de teste: capa',
    credit: 'Equipe de testes',
  });
  await addImage(client, featured, {
    cover: false,
    order: 1,
    alt: 'Imagem fictícia de teste: segunda',
  });
  const source = await client.from('species_sources').insert({
    species_id: featured,
    provider: 'manual',
    reference_title: fixtures.featured.sourceTitle,
    accessed_at: '2026-10-01',
  });
  if (source.error) throw new Error(`Falha ao criar fonte: ${source.error.message}`);
  await publish(client, featured, true);

  const related = await insertSpecies(client, fixtures.related, {
    short_description: 'Outra espécie fictícia de teste.',
  });
  await addImage(client, related, {
    cover: true,
    order: 0,
    alt: 'Imagem fictícia do peixe-sombra',
  });
  await publish(client, related);

  const accented = await insertSpecies(client, fixtures.accented, {
    short_description: 'Espécie fictícia com acento no nome, para testar a pesquisa.',
  });
  await addImage(client, accented, {
    cover: true,
    order: 0,
    alt: 'Imagem fictícia da tartaruga de teste',
  });
  await publish(client, accented);

  await insertSpecies(client, fixtures.draft, { short_description: 'Não deve aparecer no site.' });

  const check = await client.from('species').select('slug').like('slug', `${E2E_PREFIX}%`);
  if ((check.data ?? []).length !== 4) throw new Error('Os dados de teste não foram criados.');
}
