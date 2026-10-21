/**
 * Regras de arquivo de imagem (doc 01 §9, doc 03 §9.2, decisões D3 e D4).
 * Funções puras: usadas no navegador (usabilidade) e no servidor (segurança).
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const IMAGE_BUCKET = 'species-images';

export const ALLOWED_IMAGE_TYPES = {
  'image/webp': ['webp'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
} as const;

export type ImageMimeType = keyof typeof ALLOWED_IMAGE_TYPES;

/** Quantos bytes iniciais bastam para reconhecer o formato. */
export const IMAGE_SIGNATURE_BYTES = 12;

export function isAllowedMimeType(value: string): value is ImageMimeType {
  return Object.hasOwn(ALLOWED_IMAGE_TYPES, value);
}

/** Identifica o formato real pelo conteúdo (assinatura), não pelo nome. */
export function detectImageType(bytes: Uint8Array): ImageMimeType | null {
  const at = (index: number) => bytes[index];

  if (
    bytes.length >= 8 &&
    at(0) === 0x89 &&
    at(1) === 0x50 &&
    at(2) === 0x4e &&
    at(3) === 0x47 &&
    at(4) === 0x0d &&
    at(5) === 0x0a &&
    at(6) === 0x1a &&
    at(7) === 0x0a
  ) {
    return 'image/png';
  }

  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return 'image/jpeg';
  }

  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return 'image/webp';
  }

  return null;
}

/** Extensão do arquivo (minúscula, sem ponto) ou string vazia. */
export function fileExtension(fileName: string): string {
  const match = /\.([^./\\]+)$/.exec(fileName);
  return match?.[1]?.toLowerCase() ?? '';
}

/** Extensão usada no Storage para cada formato. */
export function storageExtension(mimeType: ImageMimeType): string {
  return mimeType === 'image/jpeg' ? 'jpg' : ALLOWED_IMAGE_TYPES[mimeType][0];
}

/** Caminho no bucket: species/{speciesId}/{imageId}.{ext} (D4). */
export function buildImagePath(
  speciesId: string,
  imageId: string,
  mimeType: ImageMimeType,
): string {
  return `species/${speciesId}/${imageId}.${storageExtension(mimeType)}`;
}

export interface ImageFileCheck {
  name: string;
  /** Tipo declarado pelo navegador ou pelo Storage. */
  declaredType: string;
  size: number;
  /** Bytes iniciais do conteúdo, se disponíveis. */
  head?: Uint8Array;
}

/**
 * Lista os problemas de um arquivo de imagem, em português. Lista vazia
 * significa arquivo aceito. Quando `head` é informado, o conteúdo real precisa
 * corresponder ao tipo declarado e à extensão.
 */
export function validateImageFile(file: ImageFileCheck): string[] {
  const problems: string[] = [];
  const extension = fileExtension(file.name);

  if (file.size <= 0) problems.push('O arquivo está vazio.');
  if (file.size > MAX_IMAGE_BYTES) problems.push('O arquivo passa do limite de 5 MB.');

  const declaredAllowed = isAllowedMimeType(file.declaredType);
  if (!declaredAllowed) problems.push('Formato não permitido. Use WebP, JPEG ou PNG.');

  const extensionAllowed = Object.values(ALLOWED_IMAGE_TYPES).some((list) =>
    (list as readonly string[]).includes(extension),
  );
  if (!extensionAllowed) {
    problems.push('Extensão não permitida. Use .webp, .jpg, .jpeg ou .png.');
  } else if (
    declaredAllowed &&
    !(ALLOWED_IMAGE_TYPES[file.declaredType as ImageMimeType] as readonly string[]).includes(
      extension,
    )
  ) {
    problems.push('A extensão do arquivo não corresponde ao formato informado.');
  }

  if (file.head) {
    const detected = detectImageType(file.head);
    if (!detected) {
      problems.push('O conteúdo do arquivo não é uma imagem WebP, JPEG ou PNG.');
    } else if (declaredAllowed && detected !== file.declaredType) {
      problems.push('O conteúdo do arquivo não corresponde ao formato informado.');
    }
  }

  return problems;
}
