'use client';

import type { FieldConfig } from './species-form-fields';

/**
 * Campo de formulário com rótulo, dica e erro associados (doc 01 §11):
 * o erro fica junto do campo e é anunciado por leitores de tela.
 */
export function FormField({
  config,
  value,
  error,
  onChange,
}: {
  config: FieldConfig;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = `campo-${config.name}`;
  const hintId = config.hint ? `${id}-dica` : undefined;
  const errorId = error ? `${id}-erro` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    name: config.name,
    className: 'input',
    value,
    required: config.required,
    'aria-required': config.required || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  } as const;

  let control;
  if (config.kind === 'textarea') {
    control = (
      <textarea
        {...common}
        rows={config.rows ?? 4}
        maxLength={config.maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  } else if (config.kind === 'select') {
    control = (
      <select {...common} onChange={(event) => onChange(event.target.value)}>
        {(config.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else {
    const type = config.kind === 'url' || config.kind === 'date' ? config.kind : 'text';
    control = (
      <input
        {...common}
        type={type}
        inputMode={config.kind === 'number' ? 'numeric' : undefined}
        pattern={config.kind === 'number' ? '[0-9]*' : undefined}
        maxLength={config.maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <div className={`field${config.className ? ` ${config.className}` : ''}`}>
      <label className="field__label" htmlFor={id}>
        {config.label}
        {config.required ? <span className="field__required"> (obrigatório)</span> : null}
      </label>
      {config.hint ? (
        <p className="field__hint" id={hintId}>
          {config.hint}
        </p>
      ) : null}
      {control}
      {error ? (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
