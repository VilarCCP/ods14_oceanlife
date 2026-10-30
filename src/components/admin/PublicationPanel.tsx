import { PUBLICATION_ISSUE_MESSAGES, type PublicationIssue } from '@/lib/result';

import { PublishToggle } from './PublishToggle';

/** Requisitos mínimos de publicação (doc 03 §11), na ordem do documento. */
const CHECKLIST: { label: string; issue?: PublicationIssue }[] = [
  { label: 'Nome popular, nome científico e endereço válidos' },
  { label: 'Imagem de capa definida', issue: 'missing_cover' },
  { label: 'Texto alternativo da capa preenchido', issue: 'missing_cover_alt' },
  { label: 'Resumo curto ou descrição geral', issue: 'missing_description' },
];

/**
 * Checklist de publicação validado no servidor, explicando cada impedimento
 * em texto (não só por cor), e o botão de publicar ou retirar do site.
 */
export function PublicationPanel({
  speciesId,
  speciesName,
  isPublished,
  issues,
}: {
  speciesId: string;
  speciesName: string;
  isPublished: boolean;
  /** `null` quando não foi possível consultar. */
  issues: PublicationIssue[] | null;
}) {
  if (issues === null) {
    return (
      <p className="admin-flash admin-flash--error" role="alert">
        Não foi possível conferir os requisitos de publicação. Recarregue a página.
      </p>
    );
  }

  // "Falta capa" já implica que não há texto alternativo de capa para conferir.
  const missingCover = issues.includes('missing_cover');
  const ready = issues.length === 0;

  return (
    <>
      <p>
        {isPublished
          ? 'Esta espécie está visível no site. Alterações que deixem os requisitos incompletos são bloqueadas.'
          : ready
            ? 'Todos os requisitos mínimos foram atendidos. A espécie pode ser publicada.'
            : 'Esta espécie é um rascunho e não aparece no site. Para publicar, falta:'}
      </p>
      <ul className="checklist" aria-label="Requisitos de publicação">
        {CHECKLIST.map(({ label, issue }) => {
          const missing =
            issue !== undefined &&
            (issues.includes(issue) || (issue === 'missing_cover_alt' && missingCover));
          return (
            <li
              key={label}
              className={missing ? 'checklist__item--missing' : 'checklist__item--ok'}
            >
              <span className="checklist__state">{missing ? 'Falta' : 'Pronto'}</span>
              <span>
                {label}
                {missing && issue && issues.includes(issue) ? (
                  <span className="visually-hidden">. {PUBLICATION_ISSUE_MESSAGES[issue]}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      <PublishToggle
        speciesId={speciesId}
        speciesName={speciesName}
        isPublished={isPublished}
        disabledReason={ready ? undefined : 'Complete os requisitos acima para publicar.'}
      />
      {!isPublished && !ready ? (
        <p className="admin-muted">Complete os requisitos acima para habilitar a publicação.</p>
      ) : null}
    </>
  );
}
