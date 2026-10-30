import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SpeciesGrid } from '@/components/species/SpeciesCard';
import { ImageAttribution } from '@/components/species/SpeciesImage';
import { loadPublishedSpecies } from '@/lib/data/public';
import { conservationLabel, formatDate, providerLabel } from '@/lib/format';
import { createSupabasePublicClient } from '@/lib/supabase/server';
import { listRelatedSpecies } from '@/services/species.service';
import type { SpeciesDetail } from '@/types/species';

type Params = Promise<{ slug: string }>;

async function getSpeciesOr404(slug: string): Promise<SpeciesDetail> {
  const result = await loadPublishedSpecies(slug);
  if (!result.ok) {
    // Falha de banco/rede: vai para o error.tsx, que oferece tentar de novo.
    throw new Error('Não foi possível carregar a espécie.');
  }
  // Inexistente ou não publicada: mesma resposta, sem revelar rascunhos (doc 02 §7.6).
  if (!result.data) notFound();
  return result.data;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadPublishedSpecies(slug);
  // Falha de banco não é "não encontrada": o título não pode enganar o visitante.
  if (!result.ok) return { title: 'Não foi possível carregar a espécie' };
  if (!result.data) return { title: 'Espécie não encontrada' };

  const species = result.data;
  // Metadados só com dados cadastrados, sem inventar descrição (doc 02 §12).
  const description =
    species.shortDescription ?? `${species.commonName} (${species.scientificName}) no OceanLife.`;
  return {
    title: species.commonName,
    description,
    alternates: { canonical: `/especies/${species.slug}` },
    openGraph: {
      title: species.commonName,
      description,
      images: species.cover
        ? [{ url: species.cover.url, alt: species.cover.altText ?? species.commonName }]
        : undefined,
    },
  };
}

/** Seções educativas, na ordem do doc 02 §7.3. Só aparecem quando há conteúdo. */
const INFO_SECTIONS: { key: keyof SpeciesDetail; title: string }[] = [
  { key: 'description', title: 'Visão geral' },
  { key: 'physicalCharacteristics', title: 'Características físicas' },
  { key: 'habitat', title: 'Habitat' },
  { key: 'geographicDistribution', title: 'Distribuição geográfica' },
  { key: 'diet', title: 'Alimentação' },
  { key: 'behavior', title: 'Comportamento' },
  { key: 'lifeExpectancy', title: 'Expectativa de vida' },
  { key: 'ecosystemImportance', title: 'Importância para o ecossistema' },
  { key: 'curiosities', title: 'Curiosidades' },
];

function ConservationSection({ species }: { species: SpeciesDetail }) {
  const { conservation, extinctionRisk, mainThreats } = species;
  return (
    <section className="info-section" aria-labelledby="titulo-conservacao-especie">
      <h2 id="titulo-conservacao-especie">Estado de conservação</h2>
      {conservation ? (
        <div className="conservation-card">
          <dl>
            <dt>Categoria</dt>
            <dd>{conservationLabel(conservation.category)}</dd>
            <dt>Avaliação</dt>
            <dd>
              {conservation.system}
              {conservation.assessmentYear ? `, ${conservation.assessmentYear}` : ''}
            </dd>
            <dt>Fonte</dt>
            <dd>
              <a href={conservation.sourceUrl} rel="noopener noreferrer" target="_blank">
                Consultar avaliação
                <span className="visually-hidden"> (abre em nova aba)</span>
              </a>
              , consultada em {formatDate(conservation.accessedAt)}
            </dd>
          </dl>
          {/* Uma avaliação antiga não é apresentada como necessariamente atual (doc 02 §7.4). */}
          <p className="figure-caption">
            As avaliações de conservação são revistas periodicamente. Consulte a fonte para a
            situação mais recente.
          </p>
        </div>
      ) : (
        <p>Informação não disponível no momento.</p>
      )}
      {extinctionRisk ? (
        <>
          <h3>Risco de extinção</h3>
          <p>{extinctionRisk}</p>
        </>
      ) : null}
      {mainThreats ? (
        <>
          <h3>Principais ameaças</h3>
          <p>{mainThreats}</p>
        </>
      ) : null}
    </section>
  );
}

async function RelatedSpecies({ species }: { species: SpeciesDetail }) {
  const related = await listRelatedSpecies(createSupabasePublicClient(), {
    id: species.id,
    groupSlug: species.group?.slug ?? null,
  });
  // Só exibe a seção quando há espécies relacionadas publicadas (doc 02 §7.5).
  if (!related.ok || related.data.length === 0) return null;
  return (
    <section className="section" aria-labelledby="titulo-relacionadas">
      <h2 id="titulo-relacionadas">Continue explorando</h2>
      <p className="results-summary">Outras espécies do grupo {species.group?.label}.</p>
      <SpeciesGrid species={related.data} label="Espécies relacionadas" />
    </section>
  );
}

export default async function SpeciesPage({ params }: { params: Params }) {
  const { slug } = await params;
  const species = await getSpeciesOr404(slug);
  const cover = species.cover;
  const gallery = species.images.length > 1 ? species.images : [];
  const sections = INFO_SECTIONS.filter(({ key }) => {
    const value = species[key];
    return typeof value === 'string' && value.trim() !== '';
  });

  return (
    <article className="page-width">
      <header className="species-header">
        <p className="species-header__group">
          <Link href="/especies">Espécies</Link>
          {species.group ? (
            <>
              {' / '}
              <Link href={`/especies?grupo=${species.group.slug}`}>{species.group.label}</Link>
            </>
          ) : null}
        </p>
        <h1>{species.commonName}</h1>
        <p className="species-header__scientific scientific-name">{species.scientificName}</p>
        {species.taxonomicGroup ? <p>Classificação: {species.taxonomicGroup}</p> : null}
      </header>

      {cover ? (
        <figure className="species-cover">
          <div className="species-cover__frame">
            <Image
              className="species-cover__image"
              src={cover.url}
              alt={cover.altText ?? ''}
              fill
              sizes="(min-width: 72rem) 68rem, 96vw"
              preload
            />
          </div>
          <ImageAttribution image={cover} />
        </figure>
      ) : (
        <div className="species-cover__frame">
          <div className="image-placeholder">
            <span>Imagem ainda não disponível</span>
          </div>
        </div>
      )}

      <div className="species-body">
        {species.shortDescription ? <p className="hero__lead">{species.shortDescription}</p> : null}

        {sections.map(({ key, title }) => (
          <section key={key} className="info-section" aria-labelledby={`secao-${key}`}>
            <h2 id={`secao-${key}`}>{title}</h2>
            <p>{species[key] as string}</p>
          </section>
        ))}

        {gallery.length > 0 ? (
          <section className="info-section" aria-labelledby="titulo-galeria">
            <h2 id="titulo-galeria">Galeria</h2>
            <ul className="gallery">
              {gallery.map((image) => (
                <li key={image.id}>
                  <figure className="gallery__figure">
                    <div className="gallery__frame">
                      <Image
                        className="gallery__image"
                        src={image.url}
                        alt={image.altText ?? ''}
                        fill
                        sizes="(min-width: 60rem) 22rem, 46vw"
                      />
                    </div>
                    <ImageAttribution image={image} />
                  </figure>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ConservationSection species={species} />

        {species.sources.length > 0 ? (
          <section className="info-section" aria-labelledby="titulo-fontes">
            <h2 id="titulo-fontes">Fontes e referências</h2>
            <ul className="sources-list">
              {species.sources.map((source) => (
                <li key={source.id}>
                  {source.sourceUrl ? (
                    <a href={source.sourceUrl} rel="noopener noreferrer" target="_blank">
                      {source.referenceTitle ?? providerLabel(source.provider)}
                      <span className="visually-hidden"> (abre em nova aba)</span>
                    </a>
                  ) : (
                    (source.referenceTitle ?? providerLabel(source.provider))
                  )}
                  <span className="sources-list__meta">
                    {source.provider !== 'manual' ? `${providerLabel(source.provider)}. ` : ''}
                    Consultada em {formatDate(source.accessedAt)}.
                    {source.licenseOrAttribution ? ` ${source.licenseOrAttribution}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <RelatedSpecies species={species} />

      {/* Fim da jornada: conscientização (doc 00 §7 e §8; mudança aprovada 4). */}
      <aside className="seabed" aria-labelledby="titulo-cuidar">
        <h2 id="titulo-cuidar">Cuidar do oceano também é com a gente</h2>
        <p>
          O lixo no mar, a poluição e outros impactos da atividade humana afetam a vida marinha.
          Conheça os temas de conservação abordados pelo OceanLife.
        </p>
        <p>
          <Link className="button" href="/conservacao">
            Ver temas de conservação
          </Link>
        </p>
      </aside>
    </article>
  );
}
