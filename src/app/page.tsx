import Image from 'next/image';
import Link from 'next/link';

import { Notice } from '@/components/layout/Notice';
import { SearchForm } from '@/components/search/SearchForm';
import { SpeciesGrid } from '@/components/species/SpeciesCard';
import { heroImage, siteConfig } from '@/lib/site';
import { createSupabasePublicClient } from '@/lib/supabase/server';
import { listFeaturedSpecies } from '@/services/species.service';

// Os destaques vêm do banco a cada visita: um rascunho publicado ou retirado
// aparece (ou some) sem precisar de novo build.
export const dynamic = 'force-dynamic';

/** Temas de conservação previstos no escopo do projeto (doc 00 §7). */
const CONSERVATION_THEMES = [
  'Descarte incorreto de lixo no mar',
  'Poluição da água e presença de plástico',
  'Contaminação dos ecossistemas marinhos',
  'Impactos da atividade humana',
  'Risco de extinção de espécies',
  'Preservação da biodiversidade marinha',
];

async function FeaturedSpecies() {
  let featured;
  try {
    featured = await listFeaturedSpecies(createSupabasePublicClient());
  } catch {
    featured = null;
  }

  if (!featured || !featured.ok) {
    return (
      <Notice title="Não foi possível carregar as espécies em destaque." variant="error">
        <p>
          Verifique sua conexão e <Link href="/">tente novamente</Link>, ou{' '}
          <Link href="/especies">abra o catálogo completo</Link>.
        </p>
      </Notice>
    );
  }

  if (featured.data.length === 0) {
    return (
      <Notice title="Ainda não há espécies em destaque.">
        <p>
          Enquanto isso, <Link href="/especies">explore o catálogo</Link>.
        </p>
      </Notice>
    );
  }

  return <SpeciesGrid species={featured.data} label="Espécies em destaque" />;
}

export default function HomePage() {
  return (
    <>
      <section className="hero" aria-labelledby="titulo-inicio">
        <div className={`page-width hero__grid${heroImage ? ' hero__grid--with-image' : ''}`}>
          <div>
            <h1 id="titulo-inicio" className="hero__title">
              Mergulhe e conheça quem vive no oceano
            </h1>
            <p className="hero__lead">
              Pesquise uma espécie marinha, veja suas fotos e descubra o papel que ela tem na vida
              do mar.
            </p>
            <SearchForm id="pesquisa-inicio" />
            <p className="follow-up">
              <Link className="button button--quiet" href="/especies">
                Ver todas as espécies
              </Link>
            </p>
          </div>

          {heroImage ? (
            <figure className="hero__figure">
              <Image
                className="hero__image"
                src={heroImage.src}
                alt={heroImage.alt}
                width={heroImage.width}
                height={heroImage.height}
                sizes="(min-width: 60rem) 40vw, 92vw"
                preload
              />
              <figcaption className="hero__credit">{heroImage.credit}</figcaption>
            </figure>
          ) : null}
        </div>
      </section>

      <section className="section" aria-labelledby="titulo-destaques">
        <div className="page-width">
          <div className="section-intro">
            <h2 id="titulo-destaques">Espécies em destaque</h2>
            <p>Um ponto de partida para a sua exploração.</p>
          </div>
          <FeaturedSpecies />
        </div>
      </section>

      <section className="section" aria-labelledby="titulo-conservacao">
        <div className="page-width">
          <div className="section-intro">
            <h2 id="titulo-conservacao">O oceano precisa de cuidado</h2>
            <p>
              A vida marinha é afetada pelo que acontece em terra e no mar. Estes são os temas de
              conservação que o OceanLife aborda:
            </p>
          </div>
          <ul className="topic-list">
            {CONSERVATION_THEMES.map((theme) => (
              <li key={theme}>
                <h3>{theme}</h3>
              </li>
            ))}
          </ul>
          <p className="follow-up">
            <Link className="button button--quiet" href="/conservacao">
              Conhecer os temas de conservação
            </Link>
          </p>
        </div>
      </section>

      <section className="section" aria-labelledby="titulo-ods">
        <div className="page-width">
          <div className="prose">
            <h2 id="titulo-ods">O OceanLife e a {siteConfig.sdg}</h2>
            <p>
              A ODS 14 é um dos Objetivos de Desenvolvimento Sustentável da ONU e trata da
              conservação e do uso sustentável dos oceanos.
            </p>
            <p>
              O OceanLife é um projeto educativo: ajuda a conhecer as espécies marinhas e a entender
              por que vale a pena protegê-las. Ele não substitui as ações e metas oficiais da ODS
              14.
            </p>
            <p>
              <Link href="/sobre">Saiba mais sobre o projeto</Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
