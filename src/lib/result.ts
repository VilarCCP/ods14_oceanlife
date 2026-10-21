/**
 * Resultado padronizado dos serviços. As mensagens são voltadas ao usuário,
 * em português, e nunca expõem detalhes internos (SQL, tokens, stack traces).
 */

export type ErrorCode =
  | 'validation'
  | 'not_found'
  | 'unauthenticated'
  | 'forbidden'
  | 'slug_taken'
  | 'worms_id_taken'
  | 'gbif_key_taken'
  | 'duplicate_scientific_name'
  | 'cover_conflict'
  | 'not_publishable'
  | 'invalid_file'
  | 'storage'
  | 'network'
  | 'unknown';

/** Impedimentos de publicação retornados por `species_publication_issues()`. */
export type PublicationIssue = 'missing_cover' | 'missing_cover_alt' | 'missing_description';

export const PUBLICATION_ISSUE_MESSAGES: Record<PublicationIssue, string> = {
  missing_cover: 'Escolha uma imagem de capa.',
  missing_cover_alt: 'Preencha o texto alternativo da imagem de capa.',
  missing_description: 'Preencha o resumo curto ou a descrição geral.',
};

export function isPublicationIssue(value: string): value is PublicationIssue {
  return value in PUBLICATION_ISSUE_MESSAGES;
}

export interface AppError {
  code: ErrorCode;
  message: string;
  /** Erros por campo (validação de formulário). */
  fieldErrors?: Record<string, string[]>;
  /** Lista do que falta para publicar. */
  issues?: PublicationIssue[];
  /** Espécies já cadastradas com o mesmo nome científico. */
  matches?: { id: string; slug: string; commonName: string; scientificName: string }[];
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  code: ErrorCode,
  message: string,
  extra?: Partial<AppError>,
): Result<T> {
  return { ok: false, error: { code, message, ...extra } };
}

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  validation: 'Alguns dados estão inválidos. Confira os campos destacados.',
  not_found: 'Registro não encontrado.',
  unauthenticated: 'Sua sessão expirou. Entre novamente para continuar.',
  forbidden: 'Você não tem permissão para realizar esta ação.',
  slug_taken: 'Este endereço (slug) já está em uso por outra espécie.',
  worms_id_taken: 'Já existe uma espécie cadastrada com este identificador do WoRMS.',
  gbif_key_taken: 'Já existe uma espécie cadastrada com este identificador do GBIF.',
  duplicate_scientific_name: 'Já existe uma espécie com este nome científico.',
  cover_conflict: 'Esta espécie já tem uma imagem de capa.',
  not_publishable: 'A espécie ainda não pode ser publicada.',
  invalid_file: 'O arquivo enviado não é uma imagem válida.',
  storage: 'Não foi possível concluir a operação com o arquivo. Tente novamente.',
  network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  unknown: 'Ocorreu um erro inesperado. Tente novamente.',
};

export function defaultMessage(code: ErrorCode): string {
  return DEFAULT_MESSAGES[code];
}

/** Formato mínimo dos erros do Supabase/PostgREST. */
export interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

function parseIssues(details: string | null | undefined): PublicationIssue[] {
  if (!details) return [];
  return details
    .split(',')
    .map((item) => item.trim())
    .filter(isPublicationIssue);
}

/** Converte um erro do Supabase num AppError seguro para mostrar ao usuário. */
export function fromDatabaseError(error: PostgrestLikeError | null | undefined): AppError {
  const code = error?.code ?? '';
  const message = error?.message ?? '';

  if (code === '23505') {
    if (message.includes('species_slug_key'))
      return { code: 'slug_taken', message: DEFAULT_MESSAGES.slug_taken };
    if (message.includes('species_worms_aphia_id_key')) {
      return { code: 'worms_id_taken', message: DEFAULT_MESSAGES.worms_id_taken };
    }
    if (message.includes('species_gbif_usage_key_key')) {
      return { code: 'gbif_key_taken', message: DEFAULT_MESSAGES.gbif_key_taken };
    }
    return { code: 'validation', message: 'Este registro já existe.' };
  }

  if (code === '23P01') return { code: 'cover_conflict', message: DEFAULT_MESSAGES.cover_conflict };

  if (code === 'P0001' && message === 'species_not_publishable') {
    const issues = parseIssues(error?.details);
    return {
      code: 'not_publishable',
      message:
        'Esta alteração deixaria a espécie publicada incompleta. ' +
        (issues.length > 0
          ? issues.map((issue) => PUBLICATION_ISSUE_MESSAGES[issue]).join(' ')
          : 'Confira a capa e os textos.'),
      issues,
    };
  }

  if (code === 'P0002') return { code: 'not_found', message: DEFAULT_MESSAGES.not_found };

  if (code === '42501') return { code: 'forbidden', message: DEFAULT_MESSAGES.forbidden };

  // JWT expirado ou ausente (PostgREST).
  if (code === 'PGRST301' || code === 'PGRST303') {
    return { code: 'unauthenticated', message: DEFAULT_MESSAGES.unauthenticated };
  }

  // Violações de NOT NULL, CHECK, FK ou formato que escaparam da validação.
  if (code === '23502' || code === '23503' || code === '23514' || code === '22P02') {
    return { code: 'validation', message: DEFAULT_MESSAGES.validation };
  }

  if (/fetch failed|network|ECONNREFUSED|ETIMEDOUT/i.test(message)) {
    return { code: 'network', message: DEFAULT_MESSAGES.network };
  }

  return { code: 'unknown', message: DEFAULT_MESSAGES.unknown };
}

/** Atalho: Result de falha a partir de um erro do Supabase. */
export function failFromDatabase<T = never>(
  error: PostgrestLikeError | null | undefined,
): Result<T> {
  return { ok: false, error: fromDatabaseError(error) };
}

/** Converte uma exceção inesperada (ex.: falha de rede) num Result de falha. */
export function failFromException<T = never>(exception: unknown): Result<T> {
  const message = exception instanceof Error ? exception.message : String(exception);
  return { ok: false, error: fromDatabaseError({ message }) };
}
