import Link from 'next/link';

import type { SpeciesSummary } from '@/types/species';

import { SpeciesImage } from './SpeciesImage';

const CARD_SIZES = '(min-width: 72rem) 22rem, (min-width: 40rem) 45vw, 92vw';

/**
 * Cartão de espécie: uma "janela" para a água com a foto de capa.
 * O cartão inteiro é clicável por meio de um único link (doc 02 §6.1).
 */
export function SpeciesCard({
  species,
  headingLevel = 3,
}: {
  species: SpeciesSummary;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <article className="species-card">
      <div className="species-card__window">
        <SpeciesImage image={species.cover} className="species-card__image" sizes={CARD_SIZES} />
      </div>
      <div>
        <Heading className="species-card__title">
          <Link href={`/especies/${species.slug}`} className="species-card__link">
            {species.commonName}
          </Link>
        </Heading>
        <p className="species-card__scientific scientific-name">{species.scientificName}</p>
      </div>
      {species.shortDescription ? (
        <p className="species-card__summary">{species.shortDescription}</p>
      ) : null}
    </article>
  );
}

export function SpeciesGrid({
  species,
  headingLevel = 3,
  label,
}: {
  species: SpeciesSummary[];
  headingLevel?: 2 | 3;
  label?: string;
}) {
  return (
    <ul className="species-grid" aria-label={label}>
      {species.map((item) => (
        <li key={item.id}>
          <SpeciesCard species={item} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
