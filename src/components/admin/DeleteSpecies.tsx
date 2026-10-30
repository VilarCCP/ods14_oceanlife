'use client';

import { useId, useState, useTransition } from 'react';

import { deleteSpeciesAction } from '@/app/admin/actions';
import type { AppError } from '@/lib/result';
import { normalizeText } from '@/lib/text';

import { ActionError } from './ActionError';

/**
 * Exclusão de espécie (doc 03 §13): fica separada dos botões comuns e exige
 * digitar o nome popular. O servidor confere o nome de novo antes de excluir.
 */
export function DeleteSpecies({
  speciesId,
  speciesName,
  imageCount,
  sourceCount,
}: {
  speciesId: string;
  speciesName: string;
  imageCount: number;
  sourceCount: number;
}) {
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<AppError | null>(null);
  const [pending, startTransition] = useTransition();
  const matches = normalizeText(typed) === normalizeText(speciesName);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matches || pending) return;
    setError(null);
    startTransition(async () => {
      // Em caso de sucesso a ação redireciona para a lista.
      const result = await deleteSpeciesAction(speciesId, typed);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="admin-form">
      <p>
        Excluir <strong>{speciesName}</strong> remove a espécie do painel e do site, junto com{' '}
        {imageCount === 1 ? '1 imagem' : `${imageCount} imagens`} (registros e arquivos) e{' '}
        {sourceCount === 1 ? '1 fonte' : `${sourceCount} fontes`}. Não é possível desfazer.
      </p>
      <p className="admin-muted">
        Para apenas tirar a espécie do site, use &quot;Retirar do site&quot; na seção Publicação.
      </p>
      <div className="field">
        <label className="field__label" htmlFor={inputId}>
          Para confirmar, digite o nome popular: {speciesName}
        </label>
        <input
          id={inputId}
          className="input"
          value={typed}
          autoComplete="off"
          onChange={(event) => setTyped(event.target.value)}
        />
      </div>
      {error ? <ActionError error={error} /> : null}
      <div className="form-actions">
        <button className="button button--danger" type="submit" disabled={!matches || pending}>
          {pending ? 'Excluindo…' : 'Excluir espécie definitivamente'}
        </button>
      </div>
    </form>
  );
}
