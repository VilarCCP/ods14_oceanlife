import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DeleteSpecies } from '@/components/admin/DeleteSpecies';
import { ImageManager } from '@/components/admin/ImageManager';
import { PublicationPanel } from '@/components/admin/PublicationPanel';
import { SourceManager } from '@/components/admin/SourceManager';
import { SpeciesForm } from '@/components/admin/SpeciesForm';
import { speciesToFormValues } from '@/components/admin/species-form-fields';
import { requireAdminPage } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { firstParam } from '@/lib/validation/species';
import { getPublicationIssues, getSpeciesForEdit, listAllGroups } from '@/services/species.service';

export const metadata: Metadata = { title: 'Editar espécie' };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EditSpeciesPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { client } = await requireAdminPage(`/admin/especies/${encodeURIComponent(id)}`);
  const [species, groups, issues] = await Promise.all([
    getSpeciesForEdit(client, id),
    listAllGroups(client),
    getPublicationIssues(client, id),
  ]);

  if (!species.ok) throw new Error('Falha ao carregar a espécie.');
  if (!species.data) notFound();
  const item = species.data;
  const query = await searchParams;
  const created = firstParam(query.criada) === '1';
  const imported = firstParam(query.importada) === '1';

  return (
    <>
      <p className="breadcrumb">
        <Link href="/admin/especies">Espécies</Link> / {item.commonName}
      </p>
      <div className="admin-page-head">
        <div>
          <h1>{item.commonName}</h1>
          <p className="scientific-name admin-subtitle">{item.scientificName}</p>
        </div>
        <span className={`status-badge status-badge--${item.isPublished ? 'published' : 'draft'}`}>
          {item.isPublished ? 'Publicada' : 'Rascunho'}
        </span>
      </div>
      <p className="admin-muted">
        Última alteração em {formatDateTime(item.updatedAt)}.
        {item.isPublished ? (
          <>
            {' '}
            <Link href={`/especies/${item.slug}`} target="_blank">
              Ver no site<span className="visually-hidden"> (abre em nova aba)</span>
            </Link>
          </>
        ) : null}
      </p>

      {imported ? (
        <p className="admin-flash admin-flash--success" role="status">
          Dados importados e fontes registradas. Revise a espécie; nada foi publicado.
        </p>
      ) : null}

      {created ? (
        <p className="admin-flash admin-flash--success" role="status">
          Rascunho criado. Agora adicione imagens e fontes; publique quando estiver pronto.
        </p>
      ) : null}

      <nav className="section-nav" aria-label="Seções desta espécie">
        <a href="#publicacao">Publicação</a>
        <a href="#dados">Dados</a>
        <a href="#imagens">Imagens</a>
        <a href="#fontes">Fontes</a>
        <a href="#excluir">Excluir</a>
      </nav>

      <section id="publicacao" className="panel" aria-labelledby="titulo-publicacao">
        <h2 id="titulo-publicacao">Publicação</h2>
        <PublicationPanel
          speciesId={item.id}
          speciesName={item.commonName}
          isPublished={item.isPublished}
          issues={issues.ok ? issues.data : null}
        />
      </section>

      <section id="dados" aria-labelledby="titulo-dados">
        <div className="admin-page-head">
          <h2 id="titulo-dados">Dados da espécie</h2>
          <Link
            className="button button--small button--quiet"
            href={`/admin/especies/importar?especie=${item.id}`}
          >
            Importar dados taxonômicos (WoRMS/GBIF)
          </Link>
        </div>
        <SpeciesForm
          mode="edit"
          speciesId={item.id}
          initialValues={speciesToFormValues(item)}
          groups={groups.ok ? groups.data : []}
          isPublished={item.isPublished}
        />
      </section>

      <section id="imagens" className="panel" aria-labelledby="titulo-imagens">
        <h2 id="titulo-imagens">Imagens</h2>
        <ImageManager speciesId={item.id} images={item.images} isPublished={item.isPublished} />
      </section>

      <section id="fontes" className="panel" aria-labelledby="titulo-fontes">
        <h2 id="titulo-fontes">Fontes e referências</h2>
        <SourceManager speciesId={item.id} sources={item.sources} />
      </section>

      <section id="excluir" className="panel panel--danger" aria-labelledby="titulo-excluir">
        <h2 id="titulo-excluir">Excluir espécie</h2>
        <DeleteSpecies
          speciesId={item.id}
          speciesName={item.commonName}
          imageCount={item.images.length}
          sourceCount={item.sources.length}
        />
      </section>
    </>
  );
}
