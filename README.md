# OceanLife

Plataforma educativa para explorar espécies marinhas e aprender sobre a conservação
dos oceanos, alinhada à **ODS 14 — Vida na Água**.

> Projeto em desenvolvimento. Estado atual: **fase 02 — fundação do projeto**.

## Documentação

| Documento                                                              | Conteúdo                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------- |
| [`docs/00-escopo.md`](docs/00-escopo.md)                               | Escopo e objetivos do projeto                     |
| [`docs/01-arquitetura-tecnica.md`](docs/01-arquitetura-tecnica.md)     | Arquitetura, dados, integrações e segurança       |
| [`docs/02-site-publico.md`](docs/02-site-publico.md)                   | Especificação do site público                     |
| [`docs/03-painel-administrativo.md`](docs/03-painel-administrativo.md) | Especificação do painel administrativo            |
| [`docs/decisoes.md`](docs/decisoes.md)                                 | Decisões aprovadas e limites dos planos gratuitos |

Quando `docs/decisoes.md` contradiz o texto v1.0 dos outros documentos, vale o
registro de decisões.

## Tecnologias

Next.js (App Router) · TypeScript · React · Supabase (PostgreSQL, Auth, Storage) ·
Zod · Vitest · Vercel. As versões exatas estão no `package.json` e no
`package-lock.json`.

## Requisitos

- Node.js 22 (veja `.nvmrc`). Com o [nvm](https://github.com/nvm-sh/nvm): `nvm use`.
- npm 10 ou superior.

## Como rodar localmente

```bash
git clone https://github.com/VilarCCP/ods14_oceanlife.git
cd ods14_oceanlife
npm ci
cp .env.example .env.local   # preencha a partir da fase 03
npm run dev                  # http://localhost:3000
```

## Scripts

| Comando                 | O que faz                                              |
| ----------------------- | ------------------------------------------------------ |
| `npm run dev`           | Servidor de desenvolvimento                            |
| `npm run build`         | Build de produção (inclui checagem de tipos)           |
| `npm run start`         | Executa o build de produção                            |
| `npm run lint`          | ESLint                                                 |
| `npm run typecheck`     | Checagem de tipos do TypeScript                        |
| `npm run format`        | Formata o código com o Prettier                        |
| `npm run format:check`  | Confere a formatação sem alterar arquivos              |
| `npm run test`          | Testes unitários (Vitest)                              |
| `npm run check:secrets` | Procura credenciais em arquivos versionados            |
| `npm run verify`        | Roda todas as verificações acima, na mesma ordem do CI |

## Integração contínua

Cada push e pull request roda o workflow **CI** no GitHub Actions: verificação de
segredos, formatação, lint, tipos, testes e build. Quando o `package.json` muda numa
branch, o workflow **Gerar lockfile** atualiza o `package-lock.json` na própria branch.

## Estrutura

```text
docs/                 Documentação e registro de decisões
public/assets/        Arquivos estáticos
scripts/              Scripts de apoio (ex.: verificação de segredos)
src/app/              Rotas do Next.js (App Router)
src/lib/              Utilitários compartilhados
tests/unit/           Testes unitários
.github/workflows/    CI e geração do lockfile
```

As pastas `src/components`, `src/services`, `src/types`, `src/lib/supabase`,
`src/lib/validation` e `supabase/` previstas no doc 01 §5 são criadas nas fases
que as utilizam.

## Variáveis de ambiente

Veja `.env.example`. Nunca versione `.env` ou `.env.local`. A chave de serviço do
Supabase não é usada no MVP (decisão D2).
