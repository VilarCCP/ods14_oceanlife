#!/usr/bin/env node
/**
 * Verificação simples de segredos nos arquivos versionados.
 *
 * - Falha se algum arquivo de ambiente real (.env, .env.local, ...) estiver no Git.
 * - Falha se algum arquivo versionado contiver padrões típicos de credenciais.
 *
 * Não substitui uma ferramenta dedicada, mas evita os erros mais comuns.
 * Uso: node scripts/check-secrets.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Padrões de credenciais. Cada um tem um nome legível para o relatório. */
export const SECRET_PATTERNS = [
  { name: 'Chave secreta do Supabase', regex: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  {
    name: 'Token JWT',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  },
  { name: 'Chave privada', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'Token do GitHub', regex: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
  { name: 'Chave de acesso da AWS', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    name: 'Variável de segredo preenchida',
    regex: /^[ \t]*[A-Z0-9_]*(SERVICE_ROLE|SECRET|PASSWORD|PRIVATE)[A-Z0-9_]*[ \t]*=[ \t]*\S+/m,
  },
];

/** Arquivos de ambiente que nunca devem ser versionados. */
export function isForbiddenEnvFile(path) {
  const name = path.split('/').pop() ?? '';
  return /^\.env(\..+)?$/.test(name) && name !== '.env.example';
}

/** Retorna os nomes dos padrões encontrados no conteúdo. */
export function findSecrets(content) {
  return SECRET_PATTERNS.filter(({ regex }) => regex.test(content)).map(({ name }) => name);
}

function main() {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);

  const problems = [];
  for (const file of files) {
    if (isForbiddenEnvFile(file)) {
      problems.push(`${file}: arquivo de ambiente não deve ser versionado`);
      continue;
    }
    // Este script e seus testes contêm os padrões de propósito.
    if (file === 'scripts/check-secrets.mjs' || file === 'tests/unit/check-secrets.test.ts') {
      continue;
    }
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue; // arquivo removido do disco ou ilegível
    }
    for (const name of findSecrets(content)) {
      problems.push(`${file}: possível segredo (${name})`);
    }
  }

  if (problems.length > 0) {
    console.error('Possíveis segredos encontrados:\n' + problems.map((p) => `  - ${p}`).join('\n'));
    process.exit(1);
  }
  console.log(`Nenhum segredo encontrado em ${files.length} arquivos versionados.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
