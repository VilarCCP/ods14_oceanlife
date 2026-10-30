import type { Metadata } from 'next';
import Link from 'next/link';

import { requireAdminPage } from '@/lib/auth';
import { countSpeciesByStatus } from '@/services/species.service';

export const metadata: Metadata = { title: 'Resumo' };

/**
 * Resumo do painel (doc 03 §5). Só mostra contagens calculadas de forma
 * confiável: publicadas e rascunhos.
 */
export default async function AdminHomePage() {
  const { client } = await requireAdminPage('/admin');
  const counts = await countSpeciesByStatus(client);

  return (
    <>
      <div className="admin-page-head">
        <h1>Resumo</h1>
        <Link className="button" href="/admin/especies/nova">
          Cadastrar espécie
        </Link>
      </div>

      {counts.ok ? (
        <dl className="stat-list">
          <div className="stat">
            <dt>Publicadas</dt>
            <dd className="stat__value">{counts.data.published}</dd>
            <dd>
              <Link href="/admin/especies?status=published">Ver espécies publicadas</Link>
            </dd>
          </div>
          <div className="stat">
            <dt>Rascunhos</dt>
            <dd className="stat__value">{counts.data.drafts}</dd>
            <dd>
              <Link href="/admin/especies?status=draft">Ver rascunhos</Link>
            </dd>
          </div>
        </dl>
      ) : (
        <p className="admin-flash admin-flash--error" role="alert">
          {counts.error.message}
        </p>
      )}

      <section className="panel">
        <h2>Como funciona a publicação</h2>
        <p>
          Toda espécie começa como rascunho e só aparece no site depois de publicada. Para publicar,
          ela precisa de nome popular, nome científico, uma imagem de capa com texto alternativo e
          um resumo ou descrição. Campos científicos sem fonte devem ficar vazios.
        </p>
        <p>
          <Link href="/admin/especies">Abrir a lista de espécies</Link>
        </p>
      </section>
    </>
  );
}
