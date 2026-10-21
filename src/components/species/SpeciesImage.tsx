import Image from 'next/image';

import type { SpeciesImage as SpeciesImageData } from '@/types/species';

interface SpeciesImageProps {
  image: SpeciesImageData | null;
  className?: string;
  sizes: string;
  /** Carrega cedo a imagem principal da página (acima da dobra). */
  eager?: boolean;
}

/**
 * Imagem de espécie dentro de um contêiner com proporção fixa (`fill`).
 * Sem imagem, mostra um estado de substituição em vez de quebrar a página
 * (doc 02 §7.2).
 */
export function SpeciesImage({ image, className, sizes, eager = false }: SpeciesImageProps) {
  if (!image) {
    return (
      <div className="image-placeholder">
        <span>Imagem ainda não disponível</span>
      </div>
    );
  }

  return (
    <Image
      className={className}
      src={image.url}
      // O texto alternativo é obrigatório no painel; o fallback vazio só
      // marca a imagem como decorativa caso um registro antigo não o tenha.
      alt={image.altText ?? ''}
      fill
      sizes={sizes}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
    />
  );
}

/** Legenda, crédito e licença, quando cadastrados (doc 02 §7.1 e §7.2). */
export function ImageAttribution({ image }: { image: SpeciesImageData }) {
  const credit = [image.credit, image.license].filter(Boolean).join('; ');
  if (!image.caption && !credit && !image.sourceUrl) return null;

  return (
    <figcaption className="figure-caption">
      {image.caption ? <p>{image.caption}</p> : null}
      {credit || image.sourceUrl ? (
        <p>
          {credit ? <>Crédito: {credit}</> : null}
          {credit && image.sourceUrl ? ' — ' : null}
          {image.sourceUrl ? (
            <a href={image.sourceUrl} rel="noopener noreferrer" target="_blank">
              origem da imagem
              <span className="visually-hidden"> (abre em nova aba)</span>
            </a>
          ) : null}
        </p>
      ) : null}
    </figcaption>
  );
}
