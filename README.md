# OceanLife

Plataforma educativa para explorar espécies marinhas e aprender sobre a conservação
dos oceanos, alinhada à **ODS 14 — Vida na Água**.

> Projeto em desenvolvimento. Estado atual: **fase 07 — integrações externas**.

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

| Comando                 | O que faz                                                      |
| ----------------------- | -------------------------------------------------------------- |
| `npm run dev`           | Servidor de desenvolvimento                                    |
| `npm run build`         | Build de produção (inclui checagem de tipos)                   |
| `npm run start`         | Executa o build de produção                                    |
| `npm run lint`          | ESLint                                                         |
| `npm run typecheck`     | Checagem de tipos do TypeScript                                |
| `npm run format`        | Formata o código com o Prettier                                |
| `npm run format:check`  | Confere a formatação sem alterar arquivos                      |
| `npm run test`          | Testes unitários (Vitest)                                      |
| `npm run test:e2e`      | Testes no navegador (Playwright; exige Supabase local e build) |
| `npm run check:secrets` | Procura credenciais em arquivos versionados                    |
| `npm run verify`        | Roda todas as verificações acima, na mesma ordem do CI         |

## Camada de dados

- `src/lib/supabase/`: clientes do Supabase — servidor (com a sessão), público (sempre
  anônimo, usado no site) e navegador.
- `src/lib/validation/`: esquemas Zod dos formulários e dos parâmetros de URL.
- `src/services/`: regras de negócio de espécies, imagens e fontes. Recebem o cliente
  como parâmetro e devolvem `Result` com mensagens em português, sem detalhes internos.
- `src/types/database.ts`: tipos gerados do esquema pelo workflow **Banco de dados**
  (não editar à mão).
- `tests/integration/`: testes dos serviços contra o Supabase local, rodados no CI
  (`npm run test:integration` precisa das variáveis `SUPABASE_TEST_*`).

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

## Banco de dados (Supabase)

- **Migrações:** `supabase/migrations/`. **Testes pgTAP:** `supabase/tests/database/`.
- **Seed:** `supabase/seed.sql` contém apenas registros fictícios e só roda localmente/no CI.
- O workflow **Banco de dados** aplica as migrações num Supabase local dentro do
  GitHub Actions e roda os testes de restrições, RLS e Storage a cada mudança em `supabase/`.
- O workflow **Aplicar migrações (Supabase de desenvolvimento)** é disparado à mão na aba
  Actions. Por padrão só simula; marque "Aplicar de verdade" para aplicar. Ele precisa dos
  segredos `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` no repositório.

### Configuração do projeto Supabase (uma vez)

1. **Authentication → Sign In / Providers:** desligue _Allow new users to sign up_ e mantenha
   o provedor **Email** ativo (é o login do painel).
2. **Authentication → Users → Add user → Create new user:** informe o e-mail e uma senha
   forte da pessoa administradora e marque _Auto Confirm User_. Entregue a senha por um canal
   privado. (O painel usa e-mail e senha; não depende do envio de e-mails do Supabase.)
3. **SQL Editor:** autorize o administrador (troque o e-mail):

   ```sql
   insert into public.admin_users (user_id, note)
   select id, 'administrador do OceanLife' from auth.users where email = 'pessoa@exemplo.com';
   ```

   Ser usuário autenticado não basta: só quem está em `admin_users` acessa o painel.

4. Para **revogar** o acesso: `delete from public.admin_users where user_id = (select id from auth.users where email = 'pessoa@exemplo.com');`
   Para trocar uma senha: **Authentication → Users →** (usuário) **→ Reset password** ou
   remova e crie o usuário de novo.

## Painel administrativo

Acesse `/admin`. Sem login, qualquer página do painel leva a `/admin/login`; contas sem
autorização veem um aviso de acesso negado. No painel é possível:

- ver o resumo (publicadas e rascunhos) e a lista com pesquisa, filtro e ordenação;
- cadastrar e editar espécies (rascunho), com aviso de nome científico repetido;
- enviar imagens (prévia, texto alternativo obrigatório, crédito e licença), escolher a capa,
  ordenar e excluir;
- registrar fontes manuais e corrigir ou remover fontes;
- publicar (com a lista do que falta), retirar do site e excluir com confirmação.

O formulário guarda no navegador uma cópia das alterações não salvas; se a sessão expirar,
é possível entrar de novo e recuperá-las.

### Importação do WoRMS e do GBIF

Em **Espécies → Importar do WoRMS/GBIF** (ou "Importar dados taxonômicos" na página de uma
espécie): pesquise o nome científico, escolha o registro e revise. Só são sugeridos nome
científico, classificação, nome popular em português (quando existir) e identificadores.
A espécie é salva como rascunho, com as fontes registradas; nada é publicado.

## Variáveis de ambiente

Veja `.env.example`. Nunca versione `.env` ou `.env.local`. A chave de serviço do
Supabase não é usada no MVP (decisão D2).
