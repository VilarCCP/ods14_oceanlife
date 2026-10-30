'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';

import {
  deleteImageAction,
  registerImageAction,
  reorderImagesAction,
  requestImageUploadAction,
  setCoverImageAction,
  updateImageMetadataAction,
} from '@/app/admin/actions';
import { IMAGE_BUCKET, IMAGE_SIGNATURE_BYTES, validateImageFile } from '@/lib/images';
import type { AppError } from '@/lib/result';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { imageMetadataSchema } from '@/lib/validation/media';
import { toFieldErrors } from '@/lib/validation/species';
import type { SpeciesImage } from '@/types/species';

import { ActionError } from './ActionError';

interface Metadata {
  altText: string;
  caption: string;
  credit: string;
  license: string;
  sourceUrl: string;
}

const EMPTY_METADATA: Metadata = {
  altText: '',
  caption: '',
  credit: '',
  license: '',
  sourceUrl: '',
};

const METADATA_FIELDS: {
  name: keyof Metadata;
  label: string;
  hint?: string;
  required?: boolean;
}[] = [
  {
    name: 'altText',
    label: 'Texto alternativo',
    required: true,
    hint: 'Descreva o que aparece na imagem para quem não pode vê-la.',
  },
  { name: 'caption', label: 'Legenda' },
  { name: 'credit', label: 'Crédito', hint: 'Ex.: Foto: Nome Sobrenome.' },
  { name: 'license', label: 'Licença ou direito de uso', hint: 'Ex.: Uso autorizado pelo autor.' },
  { name: 'sourceUrl', label: 'Endereço de origem' },
];

interface PendingUpload {
  key: string;
  file: File;
  previewUrl: string;
  problems: string[];
  metadata: Metadata;
  fieldErrors: Record<string, string[]>;
  status: 'ready' | 'uploading' | 'error';
  message?: string;
}

function MetadataFields({
  idPrefix,
  values,
  errors,
  onChange,
}: {
  idPrefix: string;
  values: Metadata;
  errors: Record<string, string[]>;
  onChange: (name: keyof Metadata, value: string) => void;
}) {
  return (
    <div className="metadata-fields">
      {METADATA_FIELDS.map((field) => {
        const id = `${idPrefix}-${field.name}`;
        const error = errors[field.name]?.[0];
        const hintId = field.hint ? `${id}-dica` : undefined;
        const errorId = error ? `${id}-erro` : undefined;
        return (
          <div className="field" key={field.name}>
            <label className="field__label" htmlFor={id}>
              {field.label}
              {field.required ? <span className="field__required"> (obrigatório)</span> : null}
            </label>
            {field.hint ? (
              <p className="field__hint" id={hintId}>
                {field.hint}
              </p>
            ) : null}
            <input
              className="input"
              id={id}
              type={field.name === 'sourceUrl' ? 'url' : 'text'}
              value={values[field.name]}
              onChange={(event) => onChange(field.name, event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
              aria-required={field.required || undefined}
            />
            {error ? (
              <p className="field__error" id={errorId}>
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function toMetadata(image: SpeciesImage): Metadata {
  return {
    altText: image.altText ?? '',
    caption: image.caption ?? '',
    credit: image.credit ?? '',
    license: image.license ?? '',
    sourceUrl: image.sourceUrl ?? '',
  };
}

/**
 * Gerenciamento de imagens (doc 03 §9). O arquivo vai direto do navegador
 * para o Storage com uma URL assinada (D3); o servidor confere o conteúdo real
 * antes de registrar a imagem.
 */
export function ImageManager({
  speciesId,
  images,
  isPublished,
}: {
  speciesId: string;
  images: SpeciesImage[];
  isPublished: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<AppError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Metadata>(EMPTY_METADATA);
  const [editErrors, setEditErrors] = useState<Record<string, string[]>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Libera as prévias da memória ao sair da página.
  const previews = useRef<string[]>([]);
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setNotice(null);
    const added: PendingUpload[] = [];
    for (const file of Array.from(files)) {
      const head = new Uint8Array(await file.slice(0, IMAGE_SIGNATURE_BYTES).arrayBuffer());
      const problems = validateImageFile({
        name: file.name,
        declaredType: file.type,
        size: file.size,
        head,
      });
      const previewUrl = URL.createObjectURL(file);
      previews.current.push(previewUrl);
      added.push({
        key: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        previewUrl,
        problems,
        metadata: { ...EMPTY_METADATA },
        fieldErrors: {},
        status: 'ready',
      });
    }
    setPending((current) => [...current, ...added]);
    if (fileInput.current) fileInput.current.value = '';
  }

  function updatePending(key: string, patch: Partial<PendingUpload>) {
    setPending((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function removePending(key: string) {
    setPending((current) => {
      const item = current.find((entry) => entry.key === key);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return current.filter((entry) => entry.key !== key);
    });
  }

  async function uploadOne(item: PendingUpload): Promise<boolean> {
    const metadata = imageMetadataSchema.safeParse(item.metadata);
    if (!metadata.success) {
      updatePending(item.key, {
        fieldErrors: toFieldErrors(metadata.error),
        status: 'error',
        message: 'Confira os dados da imagem.',
      });
      return false;
    }
    updatePending(item.key, { status: 'uploading', message: 'Enviando…', fieldErrors: {} });

    const ticket = await requestImageUploadAction(speciesId, {
      fileName: item.file.name,
      mimeType: item.file.type,
      size: item.file.size,
    });
    if (!ticket.ok) {
      updatePending(item.key, { status: 'error', message: ticket.error.message });
      return false;
    }

    const storage = createSupabaseBrowserClient().storage.from(IMAGE_BUCKET);
    const sent = await storage.uploadToSignedUrl(ticket.data.path, ticket.data.token, item.file, {
      contentType: item.file.type,
    });
    if (sent.error) {
      updatePending(item.key, {
        status: 'error',
        message: 'O envio do arquivo falhou. Verifique a conexão e tente novamente.',
      });
      return false;
    }

    const registered = await registerImageAction(
      speciesId,
      ticket.data.imageId,
      item.file.type,
      item.metadata,
    );
    if (!registered.ok) {
      updatePending(item.key, { status: 'error', message: registered.error.message });
      return false;
    }
    removePending(item.key);
    return true;
  }

  async function uploadAll() {
    if (uploading) return;
    setError(null);
    setNotice(null);
    setUploading(true);
    let sent = 0;
    // Um arquivo por vez: a falha de um não interrompe nem apaga os outros.
    for (const item of pending.filter(
      (entry) => entry.problems.length === 0 && entry.status !== 'uploading',
    )) {
      if (await uploadOne(item)) sent += 1;
    }
    setUploading(false);
    if (sent > 0) {
      setNotice(sent === 1 ? 'Imagem enviada.' : `${sent} imagens enviadas.`);
      router.refresh();
    }
  }

  function run(action: () => Promise<{ ok: boolean; error?: AppError }>, success: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? null);
        return;
      }
      setNotice(success);
      router.refresh();
    });
  }

  function move(index: number, delta: -1 | 1) {
    const ids = images.map((image) => image.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target] as string, ids[index] as string];
    run(() => reorderImagesAction(speciesId, ids), 'Ordem das imagens atualizada.');
  }

  function startEdit(image: SpeciesImage) {
    setEditing(image.id);
    setEditValues(toMetadata(image));
    setEditErrors({});
  }

  function saveEdit(imageId: string) {
    const parsed = imageMetadataSchema.safeParse(editValues);
    if (!parsed.success) {
      setEditErrors(toFieldErrors(parsed.error));
      return;
    }
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updateImageMetadataAction(imageId, editValues);
      if (!result.ok) {
        if (result.error.fieldErrors) setEditErrors(result.error.fieldErrors);
        setError(result.error);
        return;
      }
      setEditing(null);
      setNotice('Dados da imagem salvos.');
      router.refresh();
    });
  }

  function remove(image: SpeciesImage) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await deleteImageAction(image.id);
      setConfirmDelete(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(
        result.data.orphanedFile
          ? 'Imagem removida da espécie, mas o arquivo não pôde ser apagado do armazenamento.'
          : 'Imagem excluída.',
      );
      router.refresh();
    });
  }

  const readyCount = pending.filter((item) => item.problems.length === 0).length;

  return (
    <div className="image-manager">
      <div aria-live="polite">
        {notice ? <p className="admin-flash admin-flash--success">{notice}</p> : null}
      </div>
      {error ? <ActionError error={error} /> : null}

      {images.length === 0 ? (
        <p className="admin-muted">Nenhuma imagem enviada ainda.</p>
      ) : (
        <ol className="image-list" aria-label="Imagens na ordem da galeria">
          {images.map((image, index) => (
            <li key={image.id} className={`image-item${image.isCover ? ' image-item--cover' : ''}`}>
              <div className="image-item__thumb">
                <Image src={image.url} alt={image.altText ?? ''} fill sizes="9rem" />
              </div>
              <div className="image-item__body">
                <p className="image-item__title">
                  {index + 1}. {image.altText ?? 'Sem texto alternativo'}
                  {image.isCover ? (
                    <span className="status-badge status-badge--published">Capa</span>
                  ) : null}
                </p>
                {image.credit || image.caption ? (
                  <p className="admin-muted">
                    {[image.caption, image.credit].filter(Boolean).join(' — ')}
                  </p>
                ) : null}

                {editing === image.id ? (
                  <div className="image-item__edit">
                    <MetadataFields
                      idPrefix={`imagem-${image.id}`}
                      values={editValues}
                      errors={editErrors}
                      onChange={(name, value) =>
                        setEditValues((current) => ({ ...current, [name]: value }))
                      }
                    />
                    <div className="form-actions">
                      <button
                        type="button"
                        className="button button--small"
                        disabled={busy}
                        onClick={() => saveEdit(image.id)}
                      >
                        Salvar dados da imagem
                      </button>
                      <button
                        type="button"
                        className="button button--small button--quiet"
                        onClick={() => setEditing(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="row-actions">
                    {!image.isCover ? (
                      <button
                        type="button"
                        className="button button--small"
                        disabled={busy}
                        onClick={() => run(() => setCoverImageAction(image.id), 'Capa definida.')}
                      >
                        Definir como capa
                        <span className="visually-hidden"> (imagem {index + 1})</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="button button--small button--quiet"
                      disabled={busy || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      Mover para cima<span className="visually-hidden"> (imagem {index + 1})</span>
                    </button>
                    <button
                      type="button"
                      className="button button--small button--quiet"
                      disabled={busy || index === images.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      Mover para baixo<span className="visually-hidden"> (imagem {index + 1})</span>
                    </button>
                    <button
                      type="button"
                      className="button button--small button--quiet"
                      onClick={() => startEdit(image)}
                    >
                      Editar dados<span className="visually-hidden"> (imagem {index + 1})</span>
                    </button>
                    {confirmDelete === image.id ? (
                      <span className="confirm-inline">
                        <span>
                          Excluir esta imagem?
                          {image.isCover && isPublished
                            ? ' Ela é a capa de uma espécie publicada: escolha outra capa antes.'
                            : ''}
                        </span>
                        <button
                          type="button"
                          className="button button--small button--danger"
                          disabled={busy}
                          onClick={() => remove(image)}
                        >
                          Confirmar exclusão
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
                        onClick={() => setConfirmDelete(image.id)}
                      >
                        Excluir<span className="visually-hidden"> imagem {index + 1}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="upload-box">
        <h3>Adicionar imagens</h3>
        <p className="admin-muted">
          WebP, JPEG ou PNG, até 5 MB cada. Use apenas imagens com direito de uso confirmado.
        </p>
        <label className="field__label" htmlFor={inputId}>
          Escolher arquivos
        </label>
        <input
          ref={fileInput}
          id={inputId}
          className="input"
          type="file"
          multiple
          accept="image/webp,image/jpeg,image/png"
          onChange={(event) => void addFiles(event.target.files)}
        />

        {pending.length > 0 ? (
          <ul className="pending-list" aria-label="Imagens a enviar">
            {pending.map((item) => (
              <li key={item.key} className="pending-item">
                {/* Prévia local antes do envio (doc 03 §9.1). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="pending-item__preview" src={item.previewUrl} alt="" />
                <div className="pending-item__body">
                  <p className="image-item__title">{item.file.name}</p>
                  {item.problems.length > 0 ? (
                    <div className="admin-flash admin-flash--error" role="alert">
                      <p>Este arquivo não pode ser enviado:</p>
                      <ul>
                        {item.problems.map((problem) => (
                          <li key={problem}>{problem}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <MetadataFields
                      idPrefix={`novo-${item.key}`}
                      values={item.metadata}
                      errors={item.fieldErrors}
                      onChange={(name, value) =>
                        updatePending(item.key, {
                          metadata: { ...item.metadata, [name]: value },
                          fieldErrors: { ...item.fieldErrors, [name]: [] },
                        })
                      }
                    />
                  )}
                  {item.message ? (
                    <p
                      className={item.status === 'error' ? 'field__error' : 'admin-muted'}
                      role={item.status === 'error' ? 'alert' : 'status'}
                    >
                      {item.message}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="button button--small button--quiet"
                    disabled={item.status === 'uploading'}
                    onClick={() => removePending(item.key)}
                  >
                    Remover da lista<span className="visually-hidden"> {item.file.name}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {readyCount > 0 ? (
          <div className="form-actions">
            <button
              type="button"
              className="button"
              disabled={uploading}
              onClick={() => void uploadAll()}
            >
              {uploading
                ? 'Enviando…'
                : readyCount === 1
                  ? 'Enviar imagem'
                  : `Enviar ${readyCount} imagens`}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
