import { describe, expect, it } from 'vitest';

import {
  buildImagePath,
  detectImageType,
  fileExtension,
  MAX_IMAGE_BYTES,
  validateImageFile,
} from '@/lib/images';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const WEBP = new TextEncoder().encode('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ');
const TEXT = new TextEncoder().encode('isto não é uma imagem');

describe('detectImageType', () => {
  it('reconhece PNG, JPEG e WebP pelo conteúdo', () => {
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(JPEG)).toBe('image/jpeg');
    expect(detectImageType(WEBP)).toBe('image/webp');
  });

  it('não reconhece texto, GIF ou conteúdo curto demais', () => {
    expect(detectImageType(TEXT)).toBeNull();
    expect(detectImageType(new TextEncoder().encode('GIF89a......'))).toBeNull();
    expect(detectImageType(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});

describe('fileExtension', () => {
  it('retorna a extensão em minúsculas', () => {
    expect(fileExtension('Foto.JPG')).toBe('jpg');
    expect(fileExtension('arquivo.tar.png')).toBe('png');
    expect(fileExtension('sem-extensao')).toBe('');
  });
});

describe('validateImageFile', () => {
  it('aceita arquivo válido', () => {
    expect(
      validateImageFile({ name: 'foto.png', declaredType: 'image/png', size: 1000, head: PNG }),
    ).toEqual([]);
    expect(
      validateImageFile({ name: 'foto.jpeg', declaredType: 'image/jpeg', size: 1000, head: JPEG }),
    ).toEqual([]);
  });

  it('recusa arquivo vazio e acima de 5 MB', () => {
    expect(validateImageFile({ name: 'a.png', declaredType: 'image/png', size: 0 })).toContain(
      'O arquivo está vazio.',
    );
    expect(
      validateImageFile({ name: 'a.png', declaredType: 'image/png', size: MAX_IMAGE_BYTES + 1 }),
    ).toContain('O arquivo passa do limite de 5 MB.');
  });

  it('aceita exatamente 5 MB', () => {
    expect(
      validateImageFile({ name: 'a.png', declaredType: 'image/png', size: MAX_IMAGE_BYTES }),
    ).toEqual([]);
  });

  it('recusa formato e extensão não permitidos', () => {
    const problems = validateImageFile({ name: 'a.gif', declaredType: 'image/gif', size: 10 });
    expect(problems).toContain('Formato não permitido. Use WebP, JPEG ou PNG.');
    expect(problems).toContain('Extensão não permitida. Use .webp, .jpg, .jpeg ou .png.');
  });

  it('recusa texto disfarçado de imagem', () => {
    expect(
      validateImageFile({ name: 'falsa.png', declaredType: 'image/png', size: 10, head: TEXT }),
    ).toContain('O conteúdo do arquivo não é uma imagem WebP, JPEG ou PNG.');
  });

  it('recusa conteúdo diferente do tipo declarado', () => {
    expect(
      validateImageFile({ name: 'a.png', declaredType: 'image/png', size: 10, head: JPEG }),
    ).toContain('O conteúdo do arquivo não corresponde ao formato informado.');
  });

  it('recusa extensão diferente do tipo declarado', () => {
    expect(validateImageFile({ name: 'a.png', declaredType: 'image/jpeg', size: 10 })).toContain(
      'A extensão do arquivo não corresponde ao formato informado.',
    );
  });
});

describe('buildImagePath', () => {
  it('segue o padrão species/{speciesId}/{imageId}.{ext} exigido pelo banco', () => {
    const speciesId = '11111111-1111-1111-1111-111111111111';
    const imageId = '22222222-2222-2222-2222-222222222222';
    const path = buildImagePath(speciesId, imageId, 'image/jpeg');
    expect(path).toBe(`species/${speciesId}/${imageId}.jpg`);
    expect(path).toMatch(new RegExp(`^species/${speciesId}/[0-9a-f-]{36}\\.(webp|jpg|jpeg|png)$`));
  });
});
