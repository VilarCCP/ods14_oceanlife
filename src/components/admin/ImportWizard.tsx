'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, useTransition } from 'react';

import {
  prepareImportAction,
  saveImportAction,
  searchExternalAction,
  type ExternalSearchResult,
  type PreparedImport,
} from '@/app/admin/import-actions';
import type { AppError } from '@/lib/result';
import { slugify } from '@/lib/slug';
import { speciesInputSchema, toFieldErrors } from '@/lib/validation/species';
import type { ImportableField, ImportSuggestion } from '@/services/import.service';
import type { SpeciesGroup } from '@/types/species';

import { ActionError } from './ActionError';

const FIELD_LABELS: Record<ImportableField, string> = {
  commonName: 'Nome popular',
  scientificName: 'Nome científico',
  taxonomicGroup: 'Classificação',
  wormsAphiaId: 'Identificador WoRMS (AphiaID)',
  gbifUsageKey: 'Identificador GBIF (usageKey)',
};

const SOURCE_LABELS = { worms: 'WoRMS', gbif: 'GBIF' } as const;

const MATCH_LABELS: Record<string, string> = {
  EXACT: 'correspondência exata',
  FUZZY: 'correspondência aproximada (confira a grafia)',
  HIGHERRANK: 'só no nível superior (gênero ou família)',
};

const NONE = 'nenhum';

type EditableField = 'commonName' | 'scientificName' | 'slug' | 'displayGroup' | 'taxonomicGroup';
type DraftValues = Record<EditableField, string>;

function suggestionFor(suggestions: ImportSuggestion[], field: ImportableField) {
  return suggestions.find((s) => s.field === field);
}

/**
 * Importação assistida em três passos: pesquisar, escolher e revisar.
 * Nada é salvo antes da revisão, e nada é publicado.
 */
export function ImportWizard({
  target,
  initialTerm,
  groups,
}: {
  target: { id: string; commonName: string; scientificName: string } | null;
  initialTerm: string;
  groups: SpeciesGroup[];
}) {
  const router = useRouter();
  const ids = useId();
  const reviewRef = useRef<HTMLHeadingElement>(null);
  const [term, setTerm] = useState(initialTerm);
  const [includeGbif, setIncludeGbif] = useState(true);
  const [result, setResult] = useState<ExternalSearchResult | null>(null);
  const [wormsChoice, setWormsChoice] = useState<string | null>(null);
  const [gbifChoice, setGbifChoice] = useState<string>(NONE);
  const [prepared, setPrepared] = useState<PreparedImport | null>(null);
  const [values, setValues] = useState<DraftValues>({
    commonName: '',
    scientificName: '',
    slug: '',
    displayGroup: '',
    taxonomicGroup: '',
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [replace, setReplace] = useState<Partial<Record<ImportableField, boolean>>>({});
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<AppError | null>(null);
  const [pending, startTransition] = useTransition();

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPrepared(null);
    setWormsChoice(null);
    setGbifChoice(NONE);
    startTransition(async () => {
      const response = await searchExternalAction({ term, includeGbif });
      if (!response.ok) {
        setError(response.error);
        setResult(null);
        return;
      }
      setResult(response.data);
    });
  }

  function review() {
    if (pending || wormsChoice === null) return;
    const aphiaId = wormsChoice === NONE ? null : Number(wormsChoice);
    const gbifKey = gbifChoice === NONE ? null : Number(gbifChoice);
    if (!aphiaId && !gbifKey) {
      setError({
        code: 'validation',
        message: 'Escolha um registro do WoRMS ou do GBIF para continuar.',
      });
      return;
    }
    setError(null);
    startTransition(async () => {
      const response = await prepareImportAction({
        aphiaId,
        gbifKey,
        speciesId: target?.id ?? null,
      });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      const data = response.data;
      const get = (field: ImportableField) => suggestionFor(data.suggestions, field)?.value ?? '';
      setPrepared(data);
      setValues({
        commonName: get('commonName'),
        scientificName: get('scientificName'),
        slug: data.suggestedSlug,
        displayGroup: '',
        taxonomicGroup: get('taxonomicGroup'),
      });
      setSlugTouched(false);
      setReplace({});
      setConfirmDuplicate(false);
      setFieldErrors({});
      requestAnimationFrame(() => reviewRef.current?.focus());
    });
  }

  function setValue(field: EditableField, value: string) {
    setValues((current) => {
      const next = { ...current, [field]: value };
      if (field === 'commonName' && !slugTouched) next.slug = slugify(value);
      return next;
    });
    if (field === 'slug') setSlugTouched(true);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function save() {
    if (!prepared || pending) return;
    if (!target) {
      const parsed = speciesInputSchema.safeParse(values);
      if (!parsed.success) {
        setFieldErrors(toFieldErrors(parsed.error));
        return;
      }
    }
    setError(null);
    startTransition(async () => {
      const response = await saveImportAction({
        aphiaId: prepared.worms?.aphiaId ?? null,
        gbifKey: prepared.gbif?.usageKey ?? null,
        speciesId: target?.id ?? null,
        values: target ? undefined : values,
        replace: target ? replace : undefined,
        confirmDuplicateName: confirmDuplicate,
      });
      if (!response.ok) {
        if (response.error.code === 'slug_taken') {
          setFieldErrors({ slug: [response.error.message] });
        }
        setError(response.error);
        return;
      }
      router.push(`/admin/especies/${response.data.id}?importada=1`);
    });
  }

  const blockingConflict = prepared
    ? !target && (prepared.conflicts.sameWorms ?? prepared.conflicts.sameGbif)
    : null;
  const needsNameConfirmation = Boolean(prepared && prepared.conflicts.sameName.length > 0);
  const canSave = Boolean(
    prepared && !blockingConflict && (!needsNameConfirmation || confirmDuplicate),
  );

  return (
    <div className="import-wizard">
      <form className="panel admin-form" onSubmit={search} role="search">
        <h2>1. Pesquisar</h2>
        <div className="field">
          <label className="field__label" htmlFor={`${ids}-termo`}>
            Nome científico
          </label>
          <p className="field__hint" id={`${ids}-termo-dica`}>
            Ex.: Chelonia mydas. Também aceita parte do nome (gênero).
          </p>
          <input
            id={`${ids}-termo`}
            className="input input--scientific"
            value={term}
            maxLength={200}
            onChange={(event) => setTerm(event.target.value)}
            aria-describedby={`${ids}-termo-dica`}
          />
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={includeGbif}
            onChange={(event) => setIncludeGbif(event.target.checked)}
          />
          Consultar também o GBIF (fonte complementar)
        </label>
        <div className="form-actions">
          <button className="button" type="submit" disabled={pending}>
            {pending && !result ? 'Pesquisando…' : 'Pesquisar'}
          </button>
          {!target ? (
            <Link href="/admin/especies/nova">Cadastrar manualmente, sem importar</Link>
          ) : null}
        </div>
      </form>

      {error ? <ActionError error={error} /> : null}

      {result ? (
        <section className="panel" aria-labelledby={`${ids}-resultados`}>
          <h2 id={`${ids}-resultados`}>2. Escolher o registro</h2>
          <p className="admin-muted">
            Escolha explicitamente o registro que corresponde à espécie. Nomes ambíguos ou não
            aceitos aparecem marcados.
          </p>

          <fieldset className="choice-list">
            <legend>Resultados do WoRMS para “{result.term}”</legend>
            {result.worms.status === 'error' ? (
              <p className="admin-flash admin-flash--warning" role="alert">
                {result.worms.message}
              </p>
            ) : (
              result.worms.items.map((record) => {
                const accepted = record.status === 'accepted';
                return (
                  <label className="choice" key={record.aphiaId}>
                    <input
                      type="radio"
                      name={`${ids}-worms`}
                      value={record.aphiaId}
                      checked={wormsChoice === String(record.aphiaId)}
                      onChange={() => setWormsChoice(String(record.aphiaId))}
                    />
                    <span>
                      <span className="scientific-name">{record.scientificName}</span>
                      {record.authority ? ` ${record.authority}` : ''}
                      <span className="choice__meta">
                        {[
                          record.rank ?? 'nível não informado',
                          accepted
                            ? 'nome aceito'
                            : `nome não aceito${record.acceptedName ? ` (aceito: ${record.acceptedName})` : ''}`,
                          `AphiaID ${record.aphiaId}`,
                        ].join('; ')}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
            <label className="choice">
              <input
                type="radio"
                name={`${ids}-worms`}
                value={NONE}
                checked={wormsChoice === NONE}
                onChange={() => setWormsChoice(NONE)}
              />
              <span>Não usar o WoRMS</span>
            </label>
          </fieldset>

          {result.gbif ? (
            <fieldset className="choice-list">
              <legend>Resultados do GBIF</legend>
              {result.gbif.status === 'error' ? (
                <p className="admin-flash admin-flash--warning" role="alert">
                  {result.gbif.message}
                </p>
              ) : (
                result.gbif.items.map((candidate) => (
                  <label className="choice" key={candidate.usageKey}>
                    <input
                      type="radio"
                      name={`${ids}-gbif`}
                      value={candidate.usageKey}
                      checked={gbifChoice === String(candidate.usageKey)}
                      onChange={() => setGbifChoice(String(candidate.usageKey))}
                    />
                    <span>
                      <span className="scientific-name">{candidate.scientificName}</span>
                      <span className="choice__meta">
                        {[
                          candidate.rank ?? 'nível não informado',
                          candidate.status === 'ACCEPTED'
                            ? 'nome aceito'
                            : `situação: ${candidate.status ?? 'não informada'}`,
                          MATCH_LABELS[candidate.matchType] ?? candidate.matchType,
                          `usageKey ${candidate.usageKey}`,
                        ].join('; ')}
                      </span>
                    </span>
                  </label>
                ))
              )}
              <label className="choice">
                <input
                  type="radio"
                  name={`${ids}-gbif`}
                  value={NONE}
                  checked={gbifChoice === NONE}
                  onChange={() => setGbifChoice(NONE)}
                />
                <span>Não usar o GBIF</span>
              </label>
            </fieldset>
          ) : null}

          <div className="form-actions">
            <button
              type="button"
              className="button"
              disabled={pending || wormsChoice === null}
              onClick={review}
            >
              {pending && !prepared ? 'Buscando dados…' : 'Revisar dados'}
            </button>
            {wormsChoice === null ? (
              <span className="admin-muted">
                Escolha uma opção do WoRMS (ou “Não usar o WoRMS”).
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {prepared ? (
        <section className="panel" aria-labelledby={`${ids}-revisao`}>
          <h2 id={`${ids}-revisao`} tabIndex={-1} ref={reviewRef}>
            3. Revisar antes de salvar
          </h2>

          {prepared.warnings.map((warning) => (
            <p key={warning} className="admin-flash admin-flash--warning">
              {warning}
            </p>
          ))}

          {prepared.worms && prepared.worms.status !== 'accepted' ? (
            <p className="admin-flash admin-flash--warning">
              O registro escolhido não é o nome aceito no WoRMS
              {prepared.worms.acceptedName ? (
                <>
                  {' '}
                  (nome aceito:{' '}
                  <span className="scientific-name">{prepared.worms.acceptedName}</span>)
                </>
              ) : null}
              . Confira se é isso mesmo que você quer.
            </p>
          ) : null}

          {blockingConflict ? (
            <div className="admin-flash admin-flash--error" role="alert">
              <p>
                Esta espécie já está cadastrada com o mesmo identificador externo:{' '}
                <Link href={`/admin/especies/${blockingConflict.id}`}>
                  {blockingConflict.commonName}
                </Link>
                . Para atualizar os dados dela, use “Importar dados taxonômicos” na página da
                espécie.
              </p>
            </div>
          ) : null}

          {needsNameConfirmation && !blockingConflict ? (
            <div className="admin-flash admin-flash--warning" role="alert">
              <p>Já existe espécie com este nome científico:</p>
              <ul>
                {prepared.conflicts.sameName.map((match) => (
                  <li key={match.id}>
                    <Link href={`/admin/especies/${match.id}`} target="_blank">
                      {match.commonName}
                      <span className="visually-hidden"> (abre em nova aba)</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={confirmDuplicate}
                  onChange={(event) => setConfirmDuplicate(event.target.checked)}
                />
                Confirmo que é um registro diferente e quero salvar mesmo assim
              </label>
            </div>
          ) : null}

          {target ? (
            <ExistingSpeciesReview prepared={prepared} replace={replace} onReplace={setReplace} />
          ) : (
            <NewSpeciesReview
              ids={ids}
              prepared={prepared}
              values={values}
              groups={groups}
              fieldErrors={fieldErrors}
              onChange={setValue}
            />
          )}

          <p className="admin-muted">
            Ao salvar, as fontes consultadas são registradas com endereço, identificador e a data de
            hoje.{' '}
            {target ? 'A situação de publicação não muda.' : 'A espécie será salva como rascunho.'}
          </p>
          <div className="form-actions">
            <button type="button" className="button" disabled={pending || !canSave} onClick={save}>
              {pending ? 'Salvando…' : target ? 'Aplicar à espécie' : 'Salvar como rascunho'}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function OriginBadge({ source, edited }: { source?: 'worms' | 'gbif'; edited: boolean }) {
  if (!source)
    return <span className="origin-badge origin-badge--manual">Preenchido pela equipe</span>;
  if (edited)
    return (
      <span className="origin-badge origin-badge--manual">
        Editado (sugestão do {SOURCE_LABELS[source]})
      </span>
    );
  return <span className="origin-badge">Sugerido pelo {SOURCE_LABELS[source]}</span>;
}

function NewSpeciesReview({
  ids,
  prepared,
  values,
  groups,
  fieldErrors,
  onChange,
}: {
  ids: string;
  prepared: PreparedImport;
  values: DraftValues;
  groups: SpeciesGroup[];
  fieldErrors: Record<string, string[]>;
  onChange: (field: EditableField, value: string) => void;
}) {
  const fields: { name: EditableField; label: string; required?: boolean; hint?: string }[] = [
    {
      name: 'commonName',
      label: 'Nome popular',
      required: true,
      hint: suggestionFor(prepared.suggestions, 'commonName')
        ? undefined
        : 'O WoRMS não informou nome popular em português. Preencha com um nome de fonte confiável.',
    },
    { name: 'scientificName', label: 'Nome científico', required: true },
    {
      name: 'slug',
      label: 'Endereço (slug)',
      required: true,
      hint: `Endereço da página: /especies/${values.slug || '…'}`,
    },
    { name: 'taxonomicGroup', label: 'Classificação' },
  ];

  return (
    <div className="admin-form">
      {fields.map((field) => {
        const id = `${ids}-${field.name}`;
        const suggestion =
          field.name === 'slug'
            ? undefined
            : suggestionFor(prepared.suggestions, field.name as ImportableField);
        const error = fieldErrors[field.name]?.[0];
        return (
          <div className="field" key={field.name}>
            <label className="field__label" htmlFor={id}>
              {field.label}
              {field.required ? <span className="field__required"> (obrigatório)</span> : null}
            </label>
            {field.name !== 'slug' ? (
              <OriginBadge
                source={suggestion?.source}
                edited={Boolean(suggestion && suggestion.value !== values[field.name])}
              />
            ) : null}
            {field.hint ? <p className="field__hint">{field.hint}</p> : null}
            <input
              id={id}
              className={`input${field.name === 'scientificName' ? ' input--scientific' : ''}`}
              value={values[field.name]}
              onChange={(event) => onChange(field.name, event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-erro` : undefined}
            />
            {error ? (
              <p className="field__error" id={`${id}-erro`}>
                {error}
              </p>
            ) : null}
          </div>
        );
      })}

      <div className="field">
        <label className="field__label" htmlFor={`${ids}-grupo`}>
          Grupo
        </label>
        <p className="field__hint">Não vem das fontes: escolha o grupo educativo do catálogo.</p>
        <select
          id={`${ids}-grupo`}
          className="input"
          value={values.displayGroup}
          onChange={(event) => onChange('displayGroup', event.target.value)}
        >
          <option value="">Sem grupo</option>
          {groups.map((group) => (
            <option key={group.slug} value={group.slug}>
              {group.label}
            </option>
          ))}
        </select>
      </div>

      <dl className="import-ids">
        {prepared.worms ? (
          <>
            <dt>{FIELD_LABELS.wormsAphiaId}</dt>
            <dd>
              {prepared.worms.aphiaId}{' '}
              <a href={prepared.worms.url} target="_blank" rel="noopener noreferrer">
                ver no WoRMS<span className="visually-hidden"> (abre em nova aba)</span>
              </a>
            </dd>
          </>
        ) : null}
        {prepared.gbif ? (
          <>
            <dt>{FIELD_LABELS.gbifUsageKey}</dt>
            <dd>
              {prepared.gbif.usageKey}{' '}
              <a href={prepared.gbif.url} target="_blank" rel="noopener noreferrer">
                ver no GBIF<span className="visually-hidden"> (abre em nova aba)</span>
              </a>
            </dd>
          </>
        ) : null}
      </dl>

      <p className="admin-muted">
        Não serão preenchidos: descrição, habitat, distribuição, alimentação, comportamento,
        expectativa de vida, curiosidades e conservação. Complete-os depois, com fonte, na página da
        espécie.
      </p>
    </div>
  );
}

function ExistingSpeciesReview({
  prepared,
  replace,
  onReplace,
}: {
  prepared: PreparedImport;
  replace: Partial<Record<ImportableField, boolean>>;
  onReplace: (value: Partial<Record<ImportableField, boolean>>) => void;
}) {
  const current = prepared.current ?? {};
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      aria-label="Comparação entre os dados atuais e as sugestões"
    >
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Campo</th>
            <th scope="col">Valor atual</th>
            <th scope="col">Sugestão</th>
            <th scope="col">O que fazer</th>
          </tr>
        </thead>
        <tbody>
          {prepared.suggestions.map((suggestion) => {
            const now = (current[suggestion.field] ?? '').trim();
            const equal = now === suggestion.value.trim();
            return (
              <tr key={suggestion.field}>
                <th scope="row">{FIELD_LABELS[suggestion.field]}</th>
                <td>{now || <span className="admin-muted">(vazio)</span>}</td>
                <td>
                  {suggestion.value}
                  <br />
                  <span className="origin-badge">
                    Sugerido pelo {SOURCE_LABELS[suggestion.source]}
                  </span>
                </td>
                <td>
                  {equal ? (
                    'Igual ao atual'
                  ) : now === '' ? (
                    'Campo vazio: será preenchido'
                  ) : (
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={replace[suggestion.field] === true}
                        onChange={(event) =>
                          onReplace({ ...replace, [suggestion.field]: event.target.checked })
                        }
                      />
                      Substituir o valor atual
                      <span className="visually-hidden"> de {FIELD_LABELS[suggestion.field]}</span>
                    </label>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
