# OceanLife — Registro de decisões

Este arquivo registra as decisões aprovadas durante o planejamento (fase 01) e as
que surgirem depois. **Quando uma decisão daqui contradiz o texto v1.0 dos
documentos `00` a `03`, vale a decisão registrada aqui.** O texto dos documentos é
atualizado na fase que implementa cada mudança.

Aprovação do plano: 21/10/2026.

## Sequência de desenvolvimento

1. Análise e planejamento — concluída.
2. Fundação do projeto.
3. Banco de dados e segurança.
4. Camada de dados e serviços.
5. Site público.
6. Painel administrativo.
7. Integrações externas (WoRMS e GBIF).
8. Testes e validação.
9. Preparação para publicação.

Cada fase termina com seus próprios testes; a fase 08 é a revisão completa do
sistema, não a primeira vez que algo é testado. Nenhuma funcionalidade é
considerada concluída sem verificação.

## Princípios permanentes

- Não inventar dados científicos. Campos sem fonte ficam vazios ou como
  "Informação não disponível".
- Nenhum dado importado é publicado automaticamente.
- Textos científicos, fontes e imagens com licença são fornecidos ou aprovados
  pela equipe do projeto.
- O seed do banco contém apenas registros de teste obviamente fictícios e nunca
  vai para produção.

## Decisões técnicas (D1–D14)

| #   | Tema                         | Decisão                                                                                                                                                                                                              |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Autorização de administração | Tabela `admin_users` ligada a `auth.users` e função SQL `is_admin()` usada nas políticas RLS. Cadastro público desligado no Supabase. Administradores criados por convite e incluídos na tabela por migração ou SQL. |
| D2  | Chave de serviço             | Não usada no MVP. Todas as operações usam a sessão do usuário e passam pela RLS.                                                                                                                                     |
| D3  | Upload de imagens            | Upload direto do navegador para o Storage com URL assinada gerada pelo servidor; depois o servidor confere tamanho, MIME e os primeiros bytes e descarta o que for inválido. Limite de 5 MB mantido.                 |
| D4  | Bucket de imagens            | Bucket público, caminho `species/{species_id}/{uuid}.{ext}`, escrita só para administradores. Risco aceito: imagem de rascunho acessível a quem souber a URL, que não é adivinhável.                                 |
| D5  | Operações do painel          | Server Actions nos formulários, com checagem de sessão e permissão em cada uma. Route Handlers para importação e upload.                                                                                             |
| D6  | API pública                  | Páginas públicas leem o banco direto em Server Components. `GET /api/species` só se houver uso real.                                                                                                                 |
| D7  | Pesquisa com acentos         | Extensão `unaccent` com `ILIKE`, escapando `%` e `_`.                                                                                                                                                                |
| D8  | Grupos                       | Lista fechada de grupos educativos (peixes, mamíferos marinhos, répteis, crustáceos, moluscos, cnidários, outros), separada da taxonomia científica importada. Lista final a confirmar pela equipe.                  |
| D9  | Conservação                  | Campos estruturados: categoria, sistema de avaliação, ano da avaliação, URL da fonte e data de consulta. `extinction_risk` vira texto explicativo opcional. Nada de conservação é importado automaticamente.         |
| D10 | Testes de RLS e Storage      | Supabase local pela CLI (requer Docker) ou projeto Supabase de desenvolvimento na nuvem. **Pendente:** confirmar se há Docker.                                                                                       |
| D11 | Testes E2E                   | Playwright nos fluxos críticos.                                                                                                                                                                                      |
| D12 | Sessão expirada              | Cópia de segurança do formulário no `localStorage`, restaurada após novo login.                                                                                                                                      |
| D13 | Limite de requisições        | No MVP, autenticação e debounce na importação; sem limitador em memória.                                                                                                                                             |
| D14 | Conteúdo inicial             | A equipe fornece textos, fontes e imagens com licença verificada. **Pendente:** lista de espécies iniciais.                                                                                                          |

## Mudanças aprovadas nos documentos

1. `species_images`: adicionar `credit`, `license` e `source_url`.
2. `species`: adicionar `is_featured`, `display_group` (lista fechada, D8) e os
   campos estruturados de conservação (D9).
3. Nova tabela `admin_users` (D1).
4. Página da espécie: bloco final curto de conscientização com link para `/conservacao`.
5. Capa de espécie publicada: a remoção é bloqueada até outra capa ser escolhida.
6. Espécies relacionadas: no MVP, apenas pelo mesmo grupo.
7. Documento `00`: linha sobre o painel administrativo e remoção da frase final
   solta. **Aplicada na fase 02.**
8. Documento `01` §13: lista de endpoints completada e registro da escolha entre
   Server Actions e Route Handlers (D5).
9. **Prevenção de duplicidades** (aprovada em 21/10/2026): campos
   `worms_aphia_id` e `gbif_usage_key` em `species`, únicos quando preenchidos.
   Mesmo identificador externo bloqueia o cadastro; nome científico normalizado
   repetido gera aviso e exige confirmação. Entra no esquema na fase 03.

## Fase 02 — escolhas de fundação

| Tema             | Escolha                                                                            | Motivo                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js          | 22 LTS (`.nvmrc`, `engines`)                                                       | Exigido pelo Vitest 5 (`^22.12`) e suportado pela Vercel.                                                                                        |
| Next.js / React  | Next 16.4.2, React 19.3.1                                                          | Versões estáveis mais recentes em 21/10/2026.                                                                                                    |
| TypeScript       | 6.0.3 (não 7.x)                                                                    | O `typescript-eslint` usado pelo `eslint-config-next` exige TypeScript `<6.1`; o TypeScript 7 ainda não oferece a API de compilador que ele usa. |
| ESLint           | 9.39.5 (não 10.x)                                                                  | O `eslint-plugin-react`, incluído no `eslint-config-next`, aceita ESLint até a versão 9.                                                         |
| Formatação       | Prettier 3.9.10 + `eslint-config-prettier`                                         | Padrão de código automático, sem discussão de estilo.                                                                                            |
| Estilos          | CSS global + CSS Modules (nativos do Next.js)                                      | Evita instalar biblioteca de estilos sem necessidade concreta (doc 01 §3.1).                                                                     |
| Testes unitários | Vitest 5.0.5                                                                       | Definido no doc 01. Playwright entra quando houver telas a testar (fase 05).                                                                     |
| Versões          | Todas exatas no `package.json` (`save-exact`) e no `package-lock.json`             | Doc 01 §3.                                                                                                                                       |
| Verificação      | GitHub Actions: segredos, formatação, lint, tipos, testes e build a cada push e PR | O ambiente do assistente não tem acesso ao registro npm; a verificação roda no GitHub. Gratuito para repositórios públicos.                      |
| Lockfile         | Gerado pelo workflow "Gerar lockfile" quando o `package.json` muda numa branch     | Mesmo motivo acima.                                                                                                                              |
| Segredos         | `scripts/check-secrets.mjs` no CI + `.gitignore` cobrindo `.env*`                  | Verificação simples e sem dependências.                                                                                                          |
| `.env.example`   | Sem `SUPABASE_SERVICE_ROLE_KEY`                                                    | Decisão D2.                                                                                                                                      |

## Limites dos serviços gratuitos (consultados em 21/10/2026)

Os limites mudam; conferir de novo antes da publicação (fase 09).

**Supabase — plano Free** ([supabase.com/pricing](https://supabase.com/pricing)):

- Banco de 500 MB por projeto; armazenamento de arquivos de 1 GB.
- 5 GB de egress e 5 GB de egress em cache por mês.
- 50.000 usuários ativos por mês; até 2 projetos ativos.
- Upload máximo de 50 MB por arquivo (nosso limite de projeto é 5 MB).
- **Projetos pausam após 1 semana sem atividade** e podem ser reativados.
- Transformação de imagens **não** está incluída no plano Free.

**Vercel — plano Hobby** ([vercel.com/docs/plans/hobby](https://vercel.com/docs/plans/hobby)):

- **Somente uso pessoal e não comercial.**
- 100 GB de Fast Data Transfer; 1.000.000 de invocações de função por mês.
- 5.000 transformações de imagem por mês (otimização do `next/image`).
- Funções com duração máxima de 300 s.
- **Corpo de requisição de função limitado a 4,5 MB**
  ([vercel.com/docs/functions/limitations](https://vercel.com/docs/functions/limitations)) —
  confirma a contradição C1 e a decisão D3 (upload direto para o Storage).
- Ao exceder o limite, o recurso fica indisponível até completar 30 dias.

**WoRMS e GBIF:** termos de uso, licença e atribuição serão conferidos na fase 07,
antes da implementação das integrações.
