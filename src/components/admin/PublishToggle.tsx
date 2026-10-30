'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { publishSpeciesAction, unpublishSpeciesAction } from '@/app/admin/actions';
import { ActionError } from '@/components/admin/ActionError';
import type { AppError } from '@/lib/result';

/**
 * Publicar ou retirar a publicação. A publicação é validada no servidor; se
 * faltar algo, a mensagem explica cada impedimento (doc 03 §11).
 */
export function PublishToggle({
  speciesId,
  speciesName,
  isPublished,
  disabledReason,
  compact = false,
}: {
  speciesId: string;
  speciesName: string;
  isPublished: boolean;
  /** Motivo exibido quando a publicação já se sabe impossível. */
  disabledReason?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<AppError | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function run() {
    if (pending) return;
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = isPublished
        ? await unpublishSpeciesAction(speciesId)
        : await publishSpeciesAction(speciesId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(isPublished ? 'Publicação retirada.' : 'Espécie publicada.');
      router.refresh();
    });
  }

  const label = isPublished ? 'Retirar do site' : 'Publicar';
  const blocked = !isPublished && Boolean(disabledReason);

  return (
    <div className={compact ? 'publish-toggle publish-toggle--compact' : 'publish-toggle'}>
      <button
        type="button"
        className={`button ${compact ? 'button--small ' : ''}${isPublished ? 'button--quiet' : ''}`}
        onClick={run}
        disabled={pending || blocked}
        aria-describedby={blocked ? `bloqueio-${speciesId}` : undefined}
      >
        {pending ? 'Salvando…' : label}
        {compact ? <span className="visually-hidden"> {speciesName}</span> : null}
      </button>
      {blocked ? (
        <span className="visually-hidden" id={`bloqueio-${speciesId}`}>
          {disabledReason}
        </span>
      ) : null}
      {done ? (
        <span className="publish-toggle__done" role="status">
          {done}
        </span>
      ) : null}
      {error ? <ActionError error={error} /> : null}
    </div>
  );
}
