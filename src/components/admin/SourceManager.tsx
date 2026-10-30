'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { addSourceAction, deleteSourceAction, updateSourceAction } from '@/app/admin/actions';
import { formatDate, providerLabel } from '@/lib/format';
import type { AppError } from '@/lib/result';
import { SPECIES_SOURCE_FIELDS, sourceInputSchema } from '@/lib/validation/media';
import { toFieldErrors } from '@/lib/validation/species';
import type { SpeciesSource } from '@/types/species';

import { ActionError } from './ActionError';

type SourceField = (typeof SPECIES_SOURCE_FIELDS)[number];

const FIELD_NAMES: Record<SourceField, string> = {
  common_name: 'Nome popular',
  scientific_name: 'Nome científico',
  taxonomic_group: 'Classificação',
  short_description: 'Resumo curto',
  description: 'Descrição geral',
  habitat: 'Habitat',
  geographic_distribution: 'Distribuição geográfica',
  diet: 'Alimentação',
  physical_characteristics: 'Características físicas',
  behavior: 'Comportamento',
  life_expectancy: 'Expectativa de vida',
  main_threats: 'Principais ameaças',
  ecosystem_importance: 'Importância ecológica',
  curiosities: 'Curiosidades',
  conservation: 'Conservação',
  extinction_risk: 'Risco de extinção',
  worms_aphia_id: 'Identificador WoRMS',
  gbif_usage_key: 'Identificador GBIF',
};

interface SourceFormValues {
  referenceTitle: string;
  sourceUrl: string;
  accessedAt: string;
  licenseOrAttribution: string;
  notes: string;
  fieldsImported: SourceField[];
}

function today(): string {
  // Data local (America/Sao_Paulo) no formato AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function emptyForm(): SourceFormValues {
  return {
    referenceTitle: '',
    sourceUrl: '',
    accessedAt: today(),
    licenseOrAttribution: '',
    notes: '',
    fieldsImported: [],
  };
}

function toForm(source: SpeciesSource): SourceFormValues {
  return {
    referenceTitle: source.referenceTitle ?? '',
    sourceUrl: source.sourceUrl ?? '',
    accessedAt: source.accessedAt,
    licenseOrAttribution: source.licenseOrAttribution ?? '',
    notes: source.notes ?? '',
    fieldsImported: source.fieldsImported.filter((field): field is SourceField =>
      (SPECIES_SOURCE_FIELDS as readonly string[]).includes(field),
    ),
  };
}

function SourceForm({
  idPrefix,
  values,
  errors,
  onChange,
}: {
  idPrefix: string;
  values: SourceFormValues;
  errors: Record<string, string[]>;
  onChange: (values: SourceFormValues) => void;
}) {
  const text = (
    name: Exclude<keyof SourceFormValues, 'fieldsImported'>,
    label: string,
    options: { type?: string; hint?: string; textarea?: boolean } = {},
  ) => {
    const id = `${idPrefix}-${name}`;
    const error = errors[name]?.[0];
    const hintId = options.hint ? `${id}-dica` : undefined;
    const errorId = error ? `${id}-erro` : undefined;
    const props = {
      id,
      className: 'input',
      value: values[name],
      'aria-invalid': error ? true : undefined,
      'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
    } as const;
    return (
      <div className="field">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        {options.hint ? (
          <p className="field__hint" id={hintId}>
            {options.hint}
          </p>
        ) : null}
        {options.textarea ? (
          <textarea
            {...props}
            rows={2}
            onChange={(event) => onChange({ ...values, [name]: event.target.value })}
          />
        ) : (
          <input
            {...props}
            type={options.type ?? 'text'}
            onChange={(event) => onChange({ ...values, [name]: event.target.value })}
          />
        )}
        {error ? (
          <p className="field__error" id={errorId}>
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="source-form">
      {text('referenceTitle', 'Título da referência', {
        hint: 'Informe o título, o endereço ou ambos. Inclua a organização ou os autores.',
      })}
      {text('sourceUrl', 'Endereço (URL)', { type: 'url' })}
      {text('accessedAt', 'Data de consulta', { type: 'date' })}
      {text('licenseOrAttribution', 'Licença ou atribuição')}
      {text('notes', 'Observações', { textarea: true })}
      <fieldset className="checkbox-grid">
        <legend>Campos da espécie baseados nesta referência</legend>
        {SPECIES_SOURCE_FIELDS.map((field) => (
          <label className="checkbox" key={field}>
            <input
              type="checkbox"
              checked={values.fieldsImported.includes(field)}
              onChange={(event) =>
                onChange({
                  ...values,
                  fieldsImported: event.target.checked
                    ? [...values.fieldsImported, field]
                    : values.fieldsImported.filter((item) => item !== field),
                })
              }
            />
            {FIELD_NAMES[field]}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

/**
 * Fontes e referências (doc 03 §10). Fontes de importação (WoRMS, GBIF) são
 * criadas pela importação na fase 07; aqui se adicionam referências manuais e
 * se corrigem ou removem fontes incorretas.
 */
export function SourceManager({
  speciesId,
  sources,
}: {
  speciesId: string;
  sources: SpeciesSource[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<AppError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newValues, setNewValues] = useState<SourceFormValues>(emptyForm);
  const [newErrors, setNewErrors] = useState<Record<string, string[]>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<SourceFormValues>(emptyForm);
  const [editErrors, setEditErrors] = useState<Record<string, string[]>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function validate(provider: string, values: SourceFormValues) {
    return sourceInputSchema.safeParse({ provider, ...values });
  }

  function add() {
    const parsed = validate('manual', newValues);
    if (!parsed.success) {
      setNewErrors(toFieldErrors(parsed.error));
      return;
    }
    setNewErrors({});
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await addSourceAction(speciesId, { provider: 'manual', ...newValues });
      if (!result.ok) {
        if (result.error.fieldErrors) setNewErrors(result.error.fieldErrors);
        setError(result.error);
        return;
      }
      setNewValues(emptyForm());
      setNotice('Fonte adicionada.');
      router.refresh();
    });
  }

  function save(source: SpeciesSource) {
    const parsed = validate(source.provider, editValues);
    if (!parsed.success) {
      setEditErrors(toFieldErrors(parsed.error));
      return;
    }
    setEditErrors({});
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updateSourceAction(source.id, {
        provider: source.provider,
        ...editValues,
      });
      if (!result.ok) {
        if (result.error.fieldErrors) setEditErrors(result.error.fieldErrors);
        setError(result.error);
        return;
      }
      setEditing(null);
      setNotice('Fonte atualizada.');
      router.refresh();
    });
  }

  function remove(source: SpeciesSource) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await deleteSourceAction(source.id);
      setConfirmDelete(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice('Fonte removida.');
      router.refresh();
    });
  }

  return (
    <div className="source-manager">
      <div aria-live="polite">
        {notice ? <p className="admin-flash admin-flash--success">{notice}</p> : null}
      </div>
      {error ? <ActionError error={error} /> : null}

      {sources.length === 0 ? (
        <p className="admin-muted">Nenhuma fonte registrada.</p>
      ) : (
        <ul className="source-list">
          {sources.map((source) => (
            <li key={source.id} className="source-item">
              <p className="image-item__title">
                {source.referenceTitle ?? source.sourceUrl ?? providerLabel(source.provider)}
              </p>
              <p className="admin-muted">
                {source.provider === 'manual'
                  ? 'Referência manual'
                  : `Importado de ${providerLabel(source.provider)}`}
                . Consultada em {formatDate(source.accessedAt)}.
                {source.fieldsImported.length > 0
                  ? ` Campos: ${source.fieldsImported
                      .map((field) => FIELD_NAMES[field as SourceField] ?? field)
                      .join(', ')}.`
                  : ''}
              </p>
              {source.sourceUrl ? (
                <p>
                  <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {source.sourceUrl}
                    <span className="visually-hidden"> (abre em nova aba)</span>
                  </a>
                </p>
              ) : null}

              {editing === source.id ? (
                <>
                  <SourceForm
                    idPrefix={`fonte-${source.id}`}
                    values={editValues}
                    errors={editErrors}
                    onChange={setEditValues}
                  />
                  <div className="form-actions">
                    <button
                      type="button"
                      className="button button--small"
                      disabled={busy}
                      onClick={() => save(source)}
                    >
                      Salvar fonte
                    </button>
                    <button
                      type="button"
                      className="button button--small button--quiet"
                      onClick={() => setEditing(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <div className="row-actions">
                  <button
                    type="button"
                    className="button button--small button--quiet"
                    onClick={() => {
                      setEditing(source.id);
                      setEditValues(toForm(source));
                      setEditErrors({});
                    }}
                  >
                    Corrigir<span className="visually-hidden"> fonte</span>
                  </button>
                  {confirmDelete === source.id ? (
                    <span className="confirm-inline">
                      <span>Remover esta fonte?</span>
                      <button
                        type="button"
                        className="button button--small button--danger"
                        disabled={busy}
                        onClick={() => remove(source)}
                      >
                        Confirmar remoção
                      </button>
                      <button
                        type="button"
                        className="button button--small button--quiet"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="button button--small button--quiet button--danger-text"
                      onClick={() => setConfirmDelete(source.id)}
                    >
                      Remover<span className="visually-hidden"> fonte</span>
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="upload-box">
        <h3>Adicionar referência</h3>
        <SourceForm
          idPrefix="nova-fonte"
          values={newValues}
          errors={newErrors}
          onChange={setNewValues}
        />
        <div className="form-actions">
          <button type="button" className="button" disabled={busy} onClick={add}>
            Adicionar fonte
          </button>
        </div>
      </div>
    </div>
  );
}
