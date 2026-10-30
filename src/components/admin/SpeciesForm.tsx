'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';

import { createSpeciesAction, updateSpeciesAction } from '@/app/admin/actions';
import type { AppError } from '@/lib/result';
import { slugify } from '@/lib/slug';
import { speciesInputSchema, toFieldErrors } from '@/lib/validation/species';
import type { SpeciesGroup } from '@/types/species';

import { ActionError } from './ActionError';
import { FormField } from './FormField';
import {
  CONSERVATION_FIELDS,
  EDUCATIONAL_FIELDS,
  FIELD_LABELS,
  IDENTIFIER_FIELDS,
  parseBackup,
  sameValues,
  type FieldConfig,
  type SpeciesFormValues,
  type TextFieldName,
} from './species-form-fields';

const FIELD_ERROR_CODES = {
  slug_taken: 'slug',
  worms_id_taken: 'wormsAphiaId',
  gbif_key_taken: 'gbifUsageKey',
} as const;

function backupKey(speciesId?: string) {
  return `oceanlife:formulario-especie:${speciesId ?? 'nova'}`;
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

// A cópia local é lida uma única vez por formulário: as gravações feitas
// enquanto a pessoa digita não devem fazer o aviso de recuperação reaparecer.
const firstReads = new Map<string, string | null>();
function readStorageOnce(key: string): string | null {
  if (!firstReads.has(key)) firstReads.set(key, readStorage(key));
  return firstReads.get(key) ?? null;
}
const noSubscription = () => () => {};

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Navegador sem armazenamento local: o formulário continua funcionando.
  }
}

/**
 * Formulário de cadastro e edição de espécie (doc 03 §7).
 *
 * - Valida no navegador (mesmo esquema Zod do servidor) e revalida no servidor.
 * - Nunca apaga o que foi digitado quando algo falha.
 * - Guarda uma cópia local enquanto há alterações não salvas (decisão D12),
 *   para recuperar o trabalho se a sessão expirar ou a aba fechar.
 * - Evita envio duplicado enquanto um salvamento está em andamento.
 */
export function SpeciesForm({
  mode,
  speciesId,
  initialValues,
  groups,
  isPublished = false,
}: {
  mode: 'create' | 'edit';
  speciesId?: string;
  initialValues: SpeciesFormValues;
  groups: SpeciesGroup[];
  isPublished?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<SpeciesFormValues>(initialValues);
  const [savedValues, setSavedValues] = useState<SpeciesFormValues>(initialValues);
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [actionError, setActionError] = useState<AppError | null>(null);
  const [duplicates, setDuplicates] = useState<AppError['matches']>(undefined);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [backupDecision, setBackupDecision] = useState<'pending' | 'done'>('pending');
  const [pending, startTransition] = useTransition();
  const summaryRef = useRef<HTMLDivElement>(null);
  const key = backupKey(speciesId);

  const dirty = !sameValues(values, savedValues);

  // Oferece recuperar uma cópia local diferente do que está salvo.
  const storedRaw = useSyncExternalStore(
    noSubscription,
    () => readStorageOnce(key),
    () => null,
  );
  const stored = backupDecision === 'pending' ? parseBackup(storedRaw) : null;
  const backup = stored && !sameValues(stored, initialValues) ? stored : null;

  // Mantém a cópia local enquanto houver alterações não salvas.
  useEffect(() => {
    if (backup) return; // não sobrescreve antes de a pessoa decidir
    writeStorage(key, dirty ? JSON.stringify(values) : null);
  }, [values, dirty, key, backup]);

  // Avisa antes de sair da página com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function setField(name: TextFieldName, value: string) {
    setSuccess(null);
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (name === 'commonName' && !slugTouched) next.slug = slugify(value);
      return next;
    });
    if (fieldErrors[name]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[name];
        return next;
      });
    }
    if (name === 'scientificName') {
      setDuplicates(undefined);
      setConfirmDuplicate(false);
    }
  }

  function showErrors(errors: Record<string, string[]>) {
    setFieldErrors(errors);
    // Leva o foco ao resumo de erros, que tem links para cada campo.
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setActionError(null);
    setSuccess(null);

    const parsed = speciesInputSchema.safeParse(values);
    if (!parsed.success) {
      showErrors(toFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const options = { confirmDuplicateName: confirmDuplicate };
      const result =
        mode === 'create'
          ? await createSpeciesAction(values, options)
          : await updateSpeciesAction(speciesId, values, options);

      if (result.ok) {
        writeStorage(key, null);
        setDuplicates(undefined);
        setConfirmDuplicate(false);
        if (mode === 'create') {
          router.push(`/admin/especies/${result.data.id}?criada=1`);
          return;
        }
        setSavedValues(values);
        setSuccess(isPublished ? 'Alterações salvas e já visíveis no site.' : 'Rascunho salvo.');
        router.refresh();
        return;
      }

      const { error } = result;
      if (error.code === 'duplicate_scientific_name') {
        setDuplicates(error.matches ?? []);
        requestAnimationFrame(() => document.getElementById('aviso-duplicidade')?.focus());
        return;
      }
      if (error.code === 'validation' && error.fieldErrors) {
        showErrors(error.fieldErrors);
        return;
      }
      if (error.code in FIELD_ERROR_CODES) {
        const field = FIELD_ERROR_CODES[error.code as keyof typeof FIELD_ERROR_CODES];
        showErrors({ [field]: [error.message] });
        return;
      }
      setActionError(error);
    });
  }

  function restoreBackup() {
    if (!backup) return;
    setValues(backup);
    setSlugTouched(true);
    setBackupDecision('done');
  }

  function discardBackup() {
    writeStorage(key, null);
    setBackupDecision('done');
  }

  const errorEntries = Object.entries(fieldErrors);
  const groupField: FieldConfig = {
    name: 'displayGroup',
    label: 'Grupo',
    kind: 'select',
    hint: 'Usado no filtro do catálogo e nas espécies relacionadas.',
    options: [
      { value: '', label: 'Sem grupo' },
      ...groups.map((group) => ({ value: group.slug, label: group.label })),
    ],
  };

  const renderField = (config: FieldConfig) => (
    <FormField
      key={config.name}
      config={config}
      value={values[config.name]}
      error={fieldErrors[config.name]?.[0]}
      onChange={(value) => setField(config.name, value)}
    />
  );

  return (
    <form className="admin-form species-form" onSubmit={submit} noValidate>
      {backup ? (
        <div className="admin-flash admin-flash--info" role="status">
          <p>Há alterações deste formulário guardadas neste navegador que não foram salvas.</p>
          <div className="form-actions">
            <button type="button" className="button button--small" onClick={restoreBackup}>
              Recuperar alterações
            </button>
            <button
              type="button"
              className="button button--small button--quiet"
              onClick={discardBackup}
            >
              Descartar
            </button>
          </div>
        </div>
      ) : null}

      {errorEntries.length > 0 ? (
        <div className="admin-flash admin-flash--error" role="alert" tabIndex={-1} ref={summaryRef}>
          <p>
            Corrija {errorEntries.length === 1 ? 'o campo abaixo' : 'os campos abaixo'} para salvar:
          </p>
          <ul>
            {errorEntries.map(([name, messages]) => (
              <li key={name}>
                <a href={`#campo-${name}`}>
                  {FIELD_LABELS[name] ?? name}: {messages[0]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <fieldset className="form-section">
        <legend>Identificação</legend>
        {renderField({
          name: 'commonName',
          label: 'Nome popular',
          kind: 'text',
          required: true,
          maxLength: 150,
        })}
        {renderField({
          name: 'scientificName',
          label: 'Nome científico',
          kind: 'text',
          required: true,
          maxLength: 200,
          className: 'field--scientific',
        })}
        {renderField({
          name: 'slug',
          label: 'Endereço (slug)',
          kind: 'text',
          required: true,
          maxLength: 120,
          hint:
            mode === 'edit' && isPublished
              ? `Endereço da página: /especies/${values.slug || '…'}. Mudar o endereço de uma espécie publicada quebra links já compartilhados.`
              : `Endereço da página: /especies/${values.slug || '…'}. Gerado a partir do nome popular; pode ser ajustado.`,
        })}
        <FormField
          config={groupField}
          value={values.displayGroup}
          error={fieldErrors.displayGroup?.[0]}
          onChange={(value) => setField('displayGroup', value)}
        />
        {renderField({
          name: 'taxonomicGroup',
          label: 'Classificação',
          kind: 'text',
          maxLength: 300,
          hint: 'Classificação científica (ex.: classe e ordem), quando houver fonte.',
        })}
      </fieldset>

      {duplicates ? (
        <div
          className="admin-flash admin-flash--warning"
          id="aviso-duplicidade"
          tabIndex={-1}
          role="alert"
        >
          <p>
            Já existe {duplicates.length === 1 ? 'uma espécie' : 'espécies'} com este nome
            científico. Confira se não é a mesma antes de continuar:
          </p>
          <ul>
            {duplicates.map((match) => (
              <li key={match.id}>
                <Link href={`/admin/especies/${match.id}`} target="_blank">
                  {match.commonName} (
                  <span className="scientific-name">{match.scientificName}</span>)
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

      <fieldset className="form-section">
        <legend>Conteúdo educativo</legend>
        <p className="admin-muted">
          Nenhum campo abaixo é obrigatório para salvar um rascunho. Não preencha com suposições.
        </p>
        {EDUCATIONAL_FIELDS.map(renderField)}
      </fieldset>

      <fieldset className="form-section">
        <legend>Conservação</legend>
        <p className="admin-muted">
          Sem fonte confiável, deixe a categoria em branco: o site mostra &quot;Informação não
          disponível&quot;.
        </p>
        {CONSERVATION_FIELDS.map(renderField)}
      </fieldset>

      <fieldset className="form-section">
        <legend>Identificadores externos</legend>
        {IDENTIFIER_FIELDS.map(renderField)}
      </fieldset>

      <fieldset className="form-section">
        <legend>Página inicial</legend>
        <label className="checkbox">
          <input
            type="checkbox"
            name="isFeatured"
            checked={values.isFeatured}
            onChange={(event) => {
              setSuccess(null);
              setValues((current) => ({ ...current, isFeatured: event.target.checked }));
            }}
          />
          Mostrar entre as espécies em destaque (só aparece depois de publicada)
        </label>
      </fieldset>

      <div className="form-footer">
        {actionError ? <ActionError error={actionError} /> : null}
        {success ? (
          <p className="admin-flash admin-flash--success" role="status">
            {success}
          </p>
        ) : null}
        <div className="form-actions">
          <button className="button" type="submit" disabled={pending}>
            {pending
              ? 'Salvando…'
              : mode === 'create'
                ? 'Salvar rascunho'
                : isPublished
                  ? 'Salvar alterações'
                  : 'Salvar rascunho'}
          </button>
          <span className="form-status" aria-live="polite">
            {dirty ? 'Há alterações não salvas.' : mode === 'edit' ? 'Tudo salvo.' : ''}
          </span>
        </div>
      </div>
    </form>
  );
}
