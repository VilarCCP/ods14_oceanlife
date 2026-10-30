import type { Metadata } from 'next';
import Link from 'next/link';

import { Notice } from '@/components/layout/Notice';
import { SearchForm } from '@/components/search/SearchForm';
import { SpeciesGrid } from '@/components/species/SpeciesCard';
import { speciesCount } from '@/lib/format';
import { catalogHref } from '@/lib/navigation';
import { createSupabasePublicClient } from '@/lib/supabase/server';
import { firstParam, publicSearchParamsSchema } from '@/lib/validation/species';
import { listGroupsWithPublishedSpecies, listPublishedSpecies } from '@/services/species.service';
import type { SpeciesGroup } from '@/types/species';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParams(raw: Record<string, string | string[] | undefined>) {
  return publicSearchParamsSchema.parse({
    q: firstParam(raw.q),
    grupo: firstParam(raw.grupo),
    pagina: firstParam(raw.pagina),
  });
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = readParams(await searchParams);
  return {
    title: params.q ? `Pesquisa: ${params.q}` : 'Espécies',
    description:
      'Catálogo de espécies marinhas do OceanLife, com pesquisa por nome popular ou científico.',
    alternates: { canonical: '/especies' },
  };
}

function GroupFilter({
  groups,
  current,
  q,
}: {
  groups: SpeciesGroup[];
  current?: string;
  q: string;
}) {
  // Só mostra o filtro quando há dados suficientes para ele ser útil (doc 02 §6.3).
  if (groups.length < 2) return null;
  return (
    <nav aria-label="Filtrar por grupo">
      <ul className="group-filter">
        <li>
          <Link
            className="chip"
            href={catalogHref({ q })}
            aria-current={current ? undefined : 'true'}
          >
            Todos os grupos
          </Link>
        </li>
        {groups.map((group) => (
          <li key={group.slug}>
            <Link
              className="chip"
              href={catalogHref({ q, grupo: group.slug })}
              aria-current={current === group.slug ? 'true' : undefined}
            >
              {group.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default async function SpeciesCatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const params = readParams(await searchParams);
  const filtering = Boolean(params.q || params.grupo);

  const client = createSupabasePublicClient();
  const [result, groups] = await Promise.all([
    listPublishedSpecies(client, { q: params.q, group: params.grupo, page: params.pagina }),
    listGroupsWithPublishedSpecies(client),
  ]);

  const groupList = groups.ok ? groups.data : [];
  const currentGroup = groupList.find((group) => group.slug === params.grupo);

  return (
    <div className="page-width section">
      <div className="section-intro">
        <h1>Espécies</h1>
        <p>Explore as espécies marinhas publicadas no OceanLife.</p>
      </div>

      <div className="catalog-toolbar">
        {/* O termo continua no campo mesmo quando a consulta falha (doc 02 §13). */}
        <SearchForm defaultValue={params.q} group={params.grupo} />
        <GroupFilter groups={groupList} current={params.grupo} q={params.q} />
      </div>

      <CatalogResults
        result={result}
        q={params.q}
        grupo={params.grupo}
        groupLabel={currentGroup?.label}
        filtering={filtering}
      />
    </div>
  );
}

function CatalogResults({
  result,
  q,
  grupo,
  groupLabel,
  filtering,
}: {
  result: Awaited<ReturnType<typeof listPublishedSpecies>>;
  q: string;
  grupo?: string;
  groupLabel?: string;
  filtering: boolean;
}) {
  if (!result.ok) {
    return (
      <Notice title="Não foi possível carregar o catálogo." variant="error">
        <p>{result.error.message}</p>
        <p>
          <Link href={catalogHref({ q, grupo })}>Tentar novamente</Link>
        </p>
      </Notice>
    );
  }

  const { items, total, page, pageCount } = result.data;

  if (total === 0 && !filtering) {
    return (
      <Notice title="O catálogo ainda está sendo preparado.">
        <p>As primeiras espécies serão publicadas em breve.</p>
      </Notice>
    );
  }

  if (total === 0) {
    const detail = [q ? `para “${q}”` : null, groupLabel ? `no grupo ${groupLabel}` : null]
      .filter(Boolean)
      .join(' ');
    return (
      <Notice title={`Nenhuma espécie encontrada${detail ? ` ${detail}` : ''}.`}>
        <p>Confira a grafia ou tente outro nome, popular ou científico.</p>
        <p>
          <Link href="/especies">Limpar pesquisa e filtros</Link>
        </p>
      </Notice>
    );
  }

  if (items.length === 0) {
    return (
      <Notice title="Esta página não existe.">
        <p>
          <Link href={catalogHref({ q, grupo })}>Voltar para a primeira página</Link>
        </p>
      </Notice>
    );
  }

  return (
    <>
      <p className="results-summary" role="status">
        {filtering
          ? `${speciesCount(total)} encontrada${total === 1 ? '' : 's'}`
          : speciesCount(total)}
        {q ? ` para “${q}”` : ''}
        {groupLabel ? ` no grupo ${groupLabel}` : ''}.
      </p>

      <SpeciesGrid species={items} headingLevel={2} label="Resultados" />

      {pageCount > 1 ? (
        <nav className="pagination" aria-label="Paginação">
          {page > 1 ? (
            <Link
              className="button button--quiet"
              href={catalogHref({ q, grupo, pagina: page - 1 })}
            >
              Página anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="pagination__status">
            Página {page} de {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              className="button button--quiet"
              href={catalogHref({ q, grupo, pagina: page + 1 })}
            >
              Próxima página
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
