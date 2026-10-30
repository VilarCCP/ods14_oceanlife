import { rmSync } from 'node:fs';

import { E2E_PREFIX, e2eServiceClient, USERS_FILE } from './fixtures';

/** Remove as espécies (prefixo e2e-), seus arquivos e os usuários de teste. */
export default async function globalTeardown() {
  const client = e2eServiceClient();
  const { data } = await client.from('species').select('id').like('slug', `${E2E_PREFIX}%`);

  for (const row of data ?? []) {
    const files = await client.storage.from('species-images').list(`species/${row.id}`);
    const paths = (files.data ?? []).map((file) => `species/${row.id}/${file.name}`);
    if (paths.length > 0) await client.storage.from('species-images').remove(paths);
    // Retira a publicação antes de excluir (a capa de espécie publicada é protegida).
    await client.from('species').update({ is_published: false }).eq('id', row.id);
    await client.from('species').delete().eq('id', row.id);
  }

  const users = await client.auth.admin.listUsers({ perPage: 1000 });
  for (const user of users.data?.users ?? []) {
    if (user.email?.startsWith(E2E_PREFIX)) await client.auth.admin.deleteUser(user.id);
  }
  rmSync(USERS_FILE, { force: true });
}
