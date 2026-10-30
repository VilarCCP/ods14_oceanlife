# OceanLife — Matriz de validação (fase 08)

Cada critério de aceite dos documentos 01 (§14), 02 (§14) e 03 (§15) está ligado à
evidência que o verifica. Todos os testes rodam no CI a cada push (ver README,
"Integração contínua").

Legenda:

- ✅ verificado por teste automatizado;
- 🟡 verificado em parte; o que falta está descrito;
- ⏳ depende da fase 09 (publicação).

Siglas das evidências:

- **E2E**: `e2e/*.spec.ts` (Playwright, build de produção e Supabase local);
- **INT**: `tests/integration/services.test.ts` (serviços contra o Supabase local);
- **UNI**: `tests/unit/*.test.ts`;
- **DB**: `supabase/tests/database/*.test.sql` (pgTAP);
- **CI**: os workflows em `.github/workflows/`.

## Documento 01 — critérios técnicos (§14)

| Critério                                               | Situação | Evidência                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aplicação executa localmente com instruções documentadas | 🟡       | README, "Como rodar localmente". O CI repete os mesmos passos (`supabase start`, `npm ci`, build e `npm run start`) em `e2e.yml`. Falta a execução numa máquina da equipe (exige Docker).                                                              |
| Build de produção conclui sem erros                    | ✅       | CI: `ci.yml` (job de build) e `e2e.yml` ("Build de produção").                                                                                                                                                                                        |
| Variáveis de ambiente documentadas sem segredos        | ✅       | `.env.example` e README, "Variáveis de ambiente". `scripts/check-secrets.mjs` roda no CI; UNI `check-secrets.test.ts`.                                                                                                                               |
| Visitantes consultam apenas espécies publicadas        | ✅       | E2E `public.spec`: "mostra apenas espécies publicadas…", "rascunho responde 404…". INT: "rascunho não aparece para visitantes, nem pelo slug". DB `02_rls`.                                                                                           |
| Usuário não autorizado não altera dados (interface/API) | ✅       | E2E `admin.spec`: "usuário autenticado sem permissão é bloqueado". INT: "usuário sem permissão não cria / não altera / não exclui…", "…não consegue autorizar envio de imagem". DB `02_rls` e `03_storage` (chamadas diretas à API como anônimo e como usuário comum). |
| RLS e políticas de Storage configuradas e testadas     | ✅       | DB `01_schema`, `02_rls`, `03_storage`; CI `database.yml`.                                                                                                                                                                                            |
| Importação apresenta dados para revisão, sem publicar  | ✅       | E2E `import.spec`: "pesquisa, escolha explícita e revisão…", "salva como rascunho com as fontes registradas e sem publicar".                                                                                                                         |
| Dados sem fonte ficam vazios ou explicitamente desconhecidos | ✅  | E2E `public.spec`: "não exibe títulos de seções sem dados nem inventa conservação". DB `01_schema`: estado de conservação exige fonte. UNI `external-apis`: só campos fornecidos pela fonte são sugeridos. INT: "campos vazios como null".             |
| Várias imagens por espécie e no máximo uma capa        | ✅       | E2E `admin.spec`: "envia várias imagens de uma vez e reordena a galeria". DB `01_schema`: segunda capa recusada; `set_species_cover` troca a capa num único comando.                                                                                 |
| Erros de APIs e upload sem perder dados preenchidos    | ✅       | E2E `import.spec`: "falha da API não impede o cadastro manual". E2E `admin.spec`: "um arquivo que não é imagem é recusado…", "alterações não salvas ficam guardadas…". E2E `qualidade.spec`: sessão expirada. E2E `falhas.spec`: banco fora do ar.  |
| Documentação de banco, autenticação e deploy           | 🟡       | README: "Banco de dados (Supabase)", "Configuração do projeto Supabase" e "Painel administrativo" (criação de administradores). O deploy fica para a fase 09. ⏳                                                                                        |
| Limites e termos dos planos gratuitos verificados      | ⏳       | `decisoes.md`, "Limites dos serviços gratuitos" (consultados em 21/10/2026). Conferir de novo imediatamente antes da publicação (fase 09).                                                                                                             |

## Documento 02 — site público (§14)

| Critério                                                 | Situação | Evidência                                                                                                                                                                                         |
| -------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Página inicial apresenta o projeto e leva ao catálogo    | ✅       | E2E `public.spec`: "apresenta o projeto, a pesquisa e as espécies em destaque", "pesquisar a partir da página inicial…".                                                                           |
| Catálogo mostra apenas espécies publicadas               | ✅       | E2E `public.spec`: "mostra apenas espécies publicadas…". INT e DB `02_rls`.                                                                                                                        |
| Pesquisa por nome popular e científico                   | ✅       | E2E `public.spec`: "a pesquisa ignora acentos e maiúsculas e funciona pelo nome científico". E2E `qualidade.spec`: pesquisa só com o teclado. INT: "visitante encontra a espécie… sem acento".     |
| URL preserva o termo de pesquisa                         | ✅       | E2E `public.spec`: "…leva ao catálogo com o termo na URL"; filtro por grupo.                                                                                                                       |
| Estados de carregamento, vazio, sem resultados e erro    | ✅       | Sem resultados: E2E "sem resultados, explica e permite limpar a pesquisa". Erro: E2E `falhas.spec` (banco fora do ar, sem confundir com "vazio"). Carregamento: `especies/(catalogo)/loading.tsx` com `role="status"`. Vazio: mensagem própria quando não há espécies publicadas (verificação manual: ver abaixo). |
| Página da espécie exibe nome, capa e campos disponíveis  | ✅       | E2E `public.spec`: "mostra nomes, capa, seções com dados e fontes".                                                                                                                                |
| Galeria respeita a ordem cadastrada                      | ✅       | E2E `public.spec`: "a galeria respeita a ordem cadastrada"; `admin.spec`: reordenação refletida no site.                                                                                           |
| Informação ausente não gera conteúdo inventado nem seções vazias | ✅ | E2E `public.spec`: "não exibe títulos de seções sem dados nem inventa conservação".                                                                                                                |
| Conservação exibe fontes quando cadastradas              | ✅       | E2E `public.spec`: "mostra nomes, capa, seções com dados e fontes". DB `01_schema`: estado de conservação sem fonte é recusado.                                                                    |
| Slugs inválidos e não publicadas não revelam rascunhos   | ✅       | E2E `public.spec`: "rascunho responde 404 sem revelar que existe", "slug inválido ou inexistente responde 404"; sitemap sem rascunhos.                                                             |
| Funciona em celular, tablet e desktop                    | ✅       | E2E `mobile.spec` (Pixel 7: menu e ausência de rolagem horizontal). E2E `qualidade.spec`: 360, 768, 1024 e 1440 px sem rolagem horizontal. Capturas de tela em `capturas/<branch>`.               |
| Navegação por teclado e foco visível                     | ✅       | E2E `public.spec`: primeiro Tab no "Pular para o conteúdo". E2E `qualidade.spec`: o atalho leva ao conteúdo; indicador de foco em todos os elementos focáveis da página inicial; axe (WCAG 2.1 AA) em todas as páginas públicas. |
| Site não exige login                                     | ✅       | Todos os testes de `public.spec` e `qualidade.spec` rodam sem sessão.                                                                                                                              |
| Painel não aparece como área pública                     | ✅       | E2E `public.spec`: "a navegação pública não tem link para o painel"; robots.txt e sitemap. E2E `qualidade.spec`: `X-Robots-Tag: noindex` no painel.                                               |

Verificação manual do catálogo vazio: no Supabase local sem espécies publicadas
(`supabase db reset` sem o seed), `/especies` mostra "O catálogo ainda não tem
espécies publicadas". O teste automático não cobre esse caso porque os demais testes
dependem de espécies publicadas.

## Documento 03 — painel administrativo (§15)

| Critério                                                     | Situação | Evidência                                                                                                                                                                                          |
| ------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Não autenticado não acessa páginas nem endpoints             | ✅       | E2E `admin.spec`: "sem login, as páginas do painel levam à tela de login". Ações: `requireAdminAction` em todas as Server Actions; E2E `qualidade.spec` (sessão expirada recebe "Sua sessão expirou"). DB `02_rls` (anônimo). |
| Autenticado sem permissão também é bloqueado                 | ✅       | E2E `admin.spec`: "usuário autenticado sem permissão é bloqueado". INT: operações de usuário comum recusadas.                                                                                     |
| Não existe cadastro público de administradores              | ✅       | E2E `admin.spec`: "não existe opção de cadastro público". INT: "visitantes não conseguem criar conta". `supabase/config.toml`: `enable_signup = false`.                                           |
| Criar, listar e editar rascunhos                             | ✅       | E2E `admin.spec`: fluxo do administrador (criação, lista por situação, edição). INT: "administrador cria rascunho", "rascunho aparece no painel".                                                |
| Pesquisa por nome popular e científico                       | ✅       | E2E `admin.spec`: "a pesquisa da lista funciona por nome científico, sem acento".                                                                                                                 |
| Importação mostra a fonte e permite revisar antes de salvar  | ✅       | E2E `import.spec`: "…revisão mostram a origem de cada campo", "…não substitui valores sem confirmação".                                                                                          |
| Falha de API não impede cadastro manual                      | ✅       | E2E `import.spec`: "falha da API não impede o cadastro manual".                                                                                                                                   |
| Campos sem informação externa não recebem suposições         | ✅       | UNI `external-apis` (sugestões limitadas ao que a fonte fornece; nome popular só em português). E2E `import.spec`.                                                                               |
| Adicionar várias imagens                                     | ✅       | E2E `admin.spec`: "envia várias imagens de uma vez e reordena a galeria".                                                                                                                         |
| Definir capa e ordenar a galeria                             | ✅       | E2E `admin.spec`: "define a capa…", "…reordena a galeria". DB `01_schema`.                                                                                                                       |
| Não publica sem os requisitos mínimos                        | ✅       | E2E `admin.spec`: "a publicação fica bloqueada e explica o que falta", "não deixa a espécie publicada incompleta". INT e DB (gatilhos de publicação).                                            |
| Rascunhos não aparecem publicamente                          | ✅       | E2E `admin.spec`: "o rascunho não aparece no site". E2E `public.spec`.                                                                                                                            |
| Retirar publicação remove do catálogo público                | ✅       | E2E `admin.spec`: "retirar do site tira a espécie do catálogo público". INT.                                                                                                                      |
| Exclusão exige confirmação                                   | ✅       | E2E `admin.spec`: "a exclusão exige digitar o nome e remove a espécie"; confirmação para imagens e fontes.                                                                                        |
| RLS e Storage bloqueiam operações não autorizadas            | ✅       | DB `02_rls`, `03_storage`. INT: envio de imagem por usuário comum recusado.                                                                                                                       |
| Erros não apagam silenciosamente o conteúdo preenchido       | ✅       | E2E `admin.spec`: slug repetido mantém o texto; publicada incompleta mantém o texto; cópia local das alterações. E2E `qualidade.spec`: sessão expirada mantém o texto.                           |
| Utilizável por teclado e em telas menores                    | ✅       | E2E `qualidade.spec`: login só com o teclado; axe nas páginas do painel (inclusive com erros de validação). E2E `mobile.spec`: "no celular, o painel funciona sem rolagem horizontal da página". |

## Estados de erro e feedback do painel (doc 03 §14)

| Estado                      | Evidência                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| Carregamento e salvamento   | Botões desabilitados e com texto "Salvando…" durante o envio (componentes do painel).           |
| Sucesso                     | E2E `admin.spec`: "Rascunho salvo.", "Espécie publicada.", "Imagem enviada." etc.               |
| Falha de validação          | E2E `admin.spec`: "o formulário valida os campos obrigatórios antes de enviar".                 |
| Falha de rede / banco       | E2E `falhas.spec`: painel com o banco fora do ar.                                               |
| Falha de API externa        | E2E `import.spec`: "falha da API não impede o cadastro manual".                                 |
| Upload concluído ou falho   | E2E `admin.spec`: imagem inválida recusada; envio concluído.                                    |
| Sessão expirada             | E2E `qualidade.spec`: "salvar mostra o aviso, oferece entrar de novo e não perde o texto".      |
| Acesso negado               | E2E `admin.spec`: "usuário autenticado sem permissão é bloqueado".                              |
| Sem detalhes internos       | E2E `falhas.spec`: a página não mostra códigos do PostgREST nem mensagens de conexão.           |

## Problemas encontrados e corrigidos nesta fase

- **Sessão expirada no meio de um envio.** O proxy redirecionava qualquer requisição
  sem sessão para o login, inclusive o envio de formulários (Server Actions). O
  navegador recebia a página de login no lugar da resposta da ação. Agora só as
  navegações (GET/HEAD) são redirecionadas; a ação responde "Sua sessão expirou" e o
  texto digitado continua no formulário.

## Pendente para a fase 09

- Execução local numa máquina da equipe seguindo o README.
- Documentação do deploy na Vercel.
- Nova conferência dos limites e termos do Supabase Free e da Vercel Hobby.
- Testes de fumaça no ambiente publicado.
