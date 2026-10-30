import type { Metadata } from 'next';
import Link from 'next/link';

import { PublishToggle } from '@/components/admin/PublishToggle';
import { requireAdminPage } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { MAX_SEARCH_TERM_LENGTH } from '@/lib/text';
import {
  adminSearchParamsSchema,
  firstParam,
  type AdminSearchParams,
} from '@/lib/validation/species';
import { listAdminSpecies } from '@/services/species.service';

export const metadata: Metadata = { title: 'Espécies' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function listHref(params: Partial<AdminSearchParams>): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.sort && params.sort !== 'updated') search.set('sort', params.sort);
  if (params.pagina && params.pagina > 1) search.set('pagina', String(params.pagina));
  const query = search.toString();
  return query ? `/admin/especies?${query}` : '/admin/especies';
}

export default async function AdminSpeciesListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;
  const params = adminSearchParamsSchema.parse({
    q: firstParam(raw.q),
    status: firstParam(raw.status),
    sort: firstParam(raw.sort),
    pagina: firstParam(raw.pagina),
  });
  const { client } = await requireAdminPage(listHref(params));
  const result = await listAdminSpecies(client, params);

  const deleted = firstParam(raw.excluida) === '1';
  const orphanedFiles = Number(firstParam(raw.arquivos) ?? 0);

  return (
    <>
      <div className="admin-page-head">
        <h1>Espécies</h1>
        <div className="form-actions">
          <Link className="button button--quiet" href="/admin/especies/importar">
            Importar do WoRMS/GBIF
          </Link>
          <Link className="button" href="/admin/especies/nova">
            Cadastrar espécie
          </Link>
        </div>
      </div>

      {deleted ? (
        <p className="admin-flash admin-flash--success" role="status">
          Espécie excluída.
          {orphanedFiles > 0
            ? ` Atenção: ${orphanedFiles} arquivo(s) de imagem não puderam ser removidos do armazenamento e precisam de limpeza manual.`
            : ''}
        </p>
      ) : null}

      <form className="filter-bar" action="/admin/especies" method="get" role="search">
        <div className="field">
          <label className="field__label" htmlFor="admin-q">
            Pesquisar por nome popular ou científico
          </label>
          <input
            className="input"
            id="admin-q"
            name="q"
            type="search"
            defaultValue={params.q}
            maxLength={MAX_SEARCH_TERM_LENGTH}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="admin-status">
            Situação
          </label>
          <select className="input" id="admin-status" name="status" defaultValue={params.status}>
            <option value="all">Todas</option>
            <option value="draft">Rascunhos</option>
            <option value="published">Publicadas</option>
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="admin-sort">
            Ordenar por
          </label>
          <select className="input" id="admin-sort" name="sort" defaultValue={params.sort}>
            <option value="updated">Última alteração</option>
            <option value="name">Nome popular</option>
          </select>
        </div>
        <div className="filter-bar__actions">
          <button className="button" type="submit">
            Filtrar
          </button>
          {params.q || params.status !== 'all' || params.sort !== 'updated' ? (
            <Link href="/admin/especies">Limpar</Link>
          ) : null}
        </div>
      </form>

      {!result.ok ? (
        <p className="admin-flash admin-flash--error" role="alert">
          {result.error.message} <Link href={listHref(params)}>Tentar novamente</Link>
        </p>
      ) : result.data.total === 0 ? (
        <div className="panel">
          {params.q || params.status !== 'all' ? (
            <p>
              Nenhuma espécie encontrada com esses filtros.{' '}
              <Link href="/admin/especies">Limpar filtros</Link>
            </p>
          ) : (
            <p>
              Nenhuma espécie cadastrada ainda.{' '}
              <Link href="/admin/especies/nova">Cadastrar a primeira espécie</Link>
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="admin-muted" role="status">
            {result.data.total === 1 ? '1 espécie' : `${result.data.total} espécies`}
          </p>
          <div className="table-scroll" tabIndex={0} aria-labelledby="tabela-especies">
            <table className="data-table">
              <caption id="tabela-especies" className="visually-hidden">
                Espécies cadastradas
              </caption>
              <thead>
                <tr>
                  <th scope="col">Nome popular</th>
                  <th scope="col">Nome científico</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Capa</th>
                  <th scope="col">Última alteração</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">
                      <Link href={`/admin/especies/${item.id}`}>{item.commonName}</Link>
                    </th>
                    <td className="scientific-name">{item.scientificName}</td>
                    <td>
                      <span
                        className={`status-badge status-badge--${item.isPublished ? 'published' : 'draft'}`}
                      >
                        {item.isPublished ? 'Publicada' : 'Rascunho'}
                      </span>
                    </td>
                    <td>{item.hasCover ? 'Definida' : 'Sem capa'}</td>
                    <td>{formatDateTime(item.updatedAt)}</td>
                    <td>
                      <div className="row-actions">
                        <Link href={`/admin/especies/${item.id}`}>
                          Editar<span className="visually-hidden"> {item.commonName}</span>
                        </Link>
                        <PublishToggle
                          speciesId={item.id}
                          speciesName={item.commonName}
                          isPublished={item.isPublished}
                          compact
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.data.pageCount > 1 ? (
            <nav className="pagination" aria-label="Paginação">
              {result.data.page > 1 ? (
                <Link
                  className="button button--quiet"
                  href={listHref({ ...params, pagina: result.data.page - 1 })}
                >
                  Página anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="admin-muted">
                Página {result.data.page} de {result.data.pageCount}
              </span>
              {result.data.page < result.data.pageCount ? (
                <Link
                  className="button button--quiet"
                  href={listHref({ ...params, pagina: result.data.page + 1 })}
                >
                  Próxima página
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
