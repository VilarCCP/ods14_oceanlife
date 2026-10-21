# OceanLife --- Arquitetura Técnica

**Versão:** 1.0\
**Projeto:** OceanLife --- Plataforma Interativa de Vida Marinha\
**Objetivo deste documento:** definir a arquitetura, as tecnologias, os
dados, as integrações e os requisitos técnicos compartilhados por todo o
sistema.

------------------------------------------------------------------------

## 1. Visão geral

O OceanLife é uma plataforma educativa relacionada à **ODS 14 --- Vida
na Água**, criada para permitir que o público explore espécies marinhas
e aprenda sobre suas características, seus habitats e sua importância
ecológica.

O sistema terá duas áreas:

1.  **Site público:** permite pesquisar, explorar e consultar
    informações sobre espécies marinhas e conservação.
2.  **Painel administrativo privado:** permite que pessoas autorizadas
    cadastrem, importem, revisem, editem e publiquem conteúdo.

O site público e o painel administrativo utilizarão a mesma base de
dados, com regras de acesso diferentes. Visitantes poderão consultar
somente registros publicados. A edição ficará restrita a administradores
autenticados e autorizados.

## 2. Objetivos técnicos

-   Construir uma aplicação web responsiva e acessível.
-   Utilizar TypeScript para reduzir erros e manter tipos consistentes.
-   Centralizar os dados do catálogo em um banco de dados.
-   Armazenar as imagens próprias da plataforma em armazenamento
    controlado pelo projeto.
-   Utilizar APIs externas para auxiliar a pesquisa de dados
    taxonômicos, sem tratar respostas externas como conteúdo
    automaticamente aprovado.
-   Permitir revisão humana antes de publicar conteúdo importado.
-   Proteger o painel administrativo e os dados não publicados.
-   Manter uma arquitetura simples, adequada ao MVP e que possa crescer
    depois.
-   Priorizar serviços com plano gratuito, deixando explícito que
    limites, políticas e disponibilidade podem mudar.

## 3. Stack definida

  -----------------------------------------------------------------------
  Área                    Tecnologia              Responsabilidade
  ----------------------- ----------------------- -----------------------
  Framework web           Next.js com App Router  Páginas públicas,
                                                  páginas administrativas
                                                  e endpoints

  Linguagem               TypeScript              Tipagem e manutenção

  Interface               React                   Componentes e
                                                  interações

  Banco de dados          PostgreSQL via Supabase Dados das espécies e
                                                  metadados

  Autenticação            Supabase Auth           Login administrativo

  Imagens                 Supabase Storage        Upload e entrega das
                                                  imagens

  Validação               Zod                     Validar formulários,
                                                  parâmetros e dados de
                                                  APIs

  Hospedagem              Vercel                  Build e publicação da
                                                  aplicação

  Controle de versão      Git                     Histórico e colaboração

  Testes                  Vitest e/ou ferramentas Testes unitários e de
                          compatíveis com o       integração; adicionar
                          projeto                 E2E quando necessário
  -----------------------------------------------------------------------

As versões exatas devem ser definidas no `package.json` e no arquivo de
lock. Não atualizar dependências principais sem verificar
compatibilidade.

### 3.1 Regras de implementação

-   Utilizar o App Router do Next.js.
-   Preferir Server Components quando não houver necessidade de
    interação no navegador.
-   Usar Client Components apenas quando a funcionalidade exigir estado,
    eventos ou APIs do navegador.
-   Manter regras de negócio e integração externa em módulos de serviço,
    evitando concentrar toda a lógica nos componentes de interface.
-   Usar Route Handlers para endpoints próprios quando fizer sentido.
-   Não instalar bibliotecas adicionais sem uma necessidade concreta.
-   Não misturar credenciais de servidor com código executado no
    navegador.
-   Não criar funcionalidades fora do escopo documentado sem registrar a
    decisão.

## 4. Visão da arquitetura

Fluxo geral:

1.  O visitante abre o site público.
2.  A aplicação consulta os registros publicados no banco.
3.  O navegador recebe apenas os dados necessários à exibição.
4.  As imagens são carregadas do armazenamento do projeto.
5.  Um administrador entra no painel por autenticação.
6.  O painel chama endpoints protegidos para criar, revisar, editar e
    publicar espécies.
7.  A importação consulta APIs externas no servidor e devolve dados
    candidatos para revisão.
8.  Somente após revisão e salvamento os dados passam a fazer parte do
    catálogo.

As APIs externas não devem ser chamadas diretamente pelo navegador se
isso expuser credenciais, dificultar a validação ou permitir abuso
desnecessário.

## 5. Estrutura sugerida de pastas

``` text
oceanlife/
├── docs/
│   ├── 01-arquitetura-tecnica.md
│   ├── 02-site-publico.md
│   └── 03-painel-administrativo.md
├── public/
│   └── assets/
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── especies/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── conservacao/page.tsx
│   │   ├── sobre/page.tsx
│   │   ├── admin/
│   │   └── api/
│   ├── components/
│   │   ├── layout/
│   │   ├── species/
│   │   ├── search/
│   │   └── admin/
│   ├── lib/
│   │   ├── supabase/
│   │   └── validation/
│   ├── services/
│   │   ├── species.service.ts
│   │   ├── worms.service.ts
│   │   ├── gbif.service.ts
│   │   └── image.service.ts
│   └── types/
│       └── species.ts
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── tests/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
└── CLAUDE.md
```

A estrutura pode ser adaptada durante a implementação, mas mudanças
devem preservar a separação entre interface, serviços, validação e
acesso aos dados.

## 6. Modelo de dados

### 6.1 Tabela `species`

Armazena os dados principais de cada espécie.

Campos recomendados:

  ----------------------------------------------------------------------------
  Campo                        Tipo sugerido           Regra
  ---------------------------- ----------------------- -----------------------
  `id`                         UUID                    Chave primária

  `slug`                       text                    Único, usado na URL

  `common_name`                text                    Nome popular principal

  `scientific_name`            text                    Nome científico

  `taxonomic_group`            text, nullable          Grupo ou classificação

  `short_description`          text, nullable          Resumo para cartões

  `description`                text, nullable          Descrição geral

  `habitat`                    text, nullable          Habitat

  `geographic_distribution`    text, nullable          Distribuição geográfica

  `diet`                       text, nullable          Alimentação

  `physical_characteristics`   text, nullable          Características físicas

  `behavior`                   text, nullable          Comportamento

  `life_expectancy`            text, nullable          Expectativa de vida,
                                                       quando conhecida

  `conservation_status`        text, nullable          Categoria e sistema de
                                                       referência

  `extinction_risk`            text, nullable          Resumo do risco, se
                                                       documentado

  `main_threats`               text, nullable          Ameaças conhecidas

  `ecosystem_importance`       text, nullable          Importância ecológica

  `curiosities`                text, nullable          Curiosidades
                                                       verificadas

  `is_published`               boolean                 Padrão `false`

  `created_at`                 timestamptz             Data de criação

  `updated_at`                 timestamptz             Data da última
                                                       alteração
  ----------------------------------------------------------------------------

Todos os campos científicos que podem variar por espécie devem aceitar
ausência de informação. Não preencher lacunas com suposições. Para
categorias de conservação, guardar também o sistema/fonte e a data de
consulta por meio de tabela de fontes ou campos adicionais bem
definidos.

### 6.2 Tabela `species_images`

Permite várias imagens para uma mesma espécie.

Campos recomendados:

-   `id`: UUID, chave primária.
-   `species_id`: UUID, chave estrangeira para `species`.
-   `storage_path`: caminho do arquivo no Supabase Storage.
-   `alt_text`: descrição textual da imagem para acessibilidade.
-   `caption`: legenda opcional.
-   `is_cover`: boolean.
-   `display_order`: inteiro para controlar a ordem.
-   `created_at`: data de inclusão.

Regras: - Uma espécie pode ter várias imagens. - Cada espécie publicada
deve ter uma imagem de capa. - Deve existir no máximo uma imagem de capa
por espécie. - A imagem de capa deve ser escolhida explicitamente; não
depender apenas da primeira imagem retornada. - A remoção de uma imagem
deve atualizar os dados relacionados de forma consistente. - Validar
tipo MIME, extensão, tamanho e resultado do upload. - Usar
nomes/caminhos únicos para evitar sobrescrever arquivos de outras
imagens.

### 6.3 Tabela `species_sources`

Registra de onde vieram dados importados ou revisados.

Campos recomendados:

-   `id`: UUID.
-   `species_id`: UUID.
-   `provider`: nome da fonte, como WoRMS, GBIF ou referência manual.
-   `source_url`: URL da fonte.
-   `source_record_id`: identificador do registro externo, quando
    existir.
-   `fields_imported`: lista ou objeto JSON dos campos
    sugeridos/importados.
-   `accessed_at`: data em que a fonte foi consultada.
-   `license_or_attribution`: informação de licença/atribuição, quando
    aplicável.
-   `created_at`: data do registro.

O histórico deve permitir entender quais dados vieram de fontes externas
e quando foram consultados.

### 6.4 Tabela opcional `content_sources`

Pode ser criada caso seja necessário associar fontes específicas a
campos ou textos educativos.

Campos sugeridos: `id`, `species_id`, `field_name`, `reference_title`,
`reference_url`, `accessed_at`, `notes`.

### 6.5 Restrições e integridade

-   `slug` deve ser único.
-   `common_name` e `scientific_name` são obrigatórios para salvar uma
    espécie.
-   Uma espécie não pode ser publicada sem os requisitos mínimos de
    publicação.
-   Deve haver no máximo uma capa por espécie. Implementar a restrição
    no banco quando possível, por exemplo com índice único parcial.
-   Usar chaves estrangeiras e políticas de exclusão coerentes.
-   Evitar apagar registros científicos por acidente; confirmar ações
    destrutivas no painel.
-   Usar datas em UTC no banco e apresentar datas conforme a necessidade
    da interface.

## 7. APIs externas e importação

### 7.1 WoRMS

Usar a API REST oficial do World Register of Marine Species para
auxiliar a identificação taxonômica de organismos marinhos.

Documentação: https://www.marinespecies.org/rest/

Usos possíveis: - Pesquisar um nome científico. - Obter identificador e
nome aceito, quando disponíveis. - Consultar classificação taxonômica e
informações retornadas pela API. - Registrar URL, identificador e data
de consulta.

### 7.2 GBIF

Usar a Species API do GBIF como fonte complementar de informação
taxonômica.

Documentação: https://techdocs.gbif.org/en/openapi/v1/species

A API pode não fornecer todos os campos educativos desejados. A ausência
de informação deve ser tratada normalmente; não preencher os campos
ausentes com texto inventado.

### 7.3 Fluxo de importação

1.  Administrador informa nome científico ou termo de pesquisa.
2.  Servidor consulta as fontes disponíveis.
3.  A aplicação mostra resultados e informa de qual fonte cada dado
    veio.
4.  Administrador escolhe um registro.
5.  Os dados retornados são apresentados em formulário editável.
6.  O administrador revisa e corrige os campos.
7.  A aplicação registra as fontes consultadas.
8.  A espécie é salva como rascunho.
9.  A publicação acontece somente após validação.

A importação nunca deve publicar automaticamente uma espécie.

### 7.4 Falhas e limites de APIs

-   Implementar timeout e tratamento de erros.
-   Mostrar mensagens compreensíveis quando uma API estiver
    indisponível.
-   Não bloquear edição manual quando a importação falhar.
-   Tratar respostas incompletas, resultados múltiplos e nomes ambíguos.
-   Evitar chamadas repetitivas desnecessárias; considerar cache quando
    apropriado.
-   Não pressupor que uma API oferece imagens licenciadas para
    reutilização.
-   Respeitar atribuição, licenças e condições de uso de cada fonte.
-   Guardar a data da consulta para que dados desatualizados possam ser
    identificados.

### 7.5 Conservação

Não inferir que uma espécie está ameaçada apenas porque há informação
taxonômica disponível. Informações sobre risco de extinção devem ter uma
fonte confiável, sistema de avaliação e data de consulta quando
possível. Se não houver dados suficientes, exibir "Informação não
disponível" ou equivalente.

## 8. Banco, autenticação e autorização

### 8.1 Supabase

Supabase será utilizado para PostgreSQL, autenticação e armazenamento de
arquivos. Confirmar quotas, limites, política de pausa e condições do
plano gratuito antes da publicação e periodicamente durante o projeto.

### 8.2 Painel privado

-   Desabilitar cadastro público de administradores.
-   Somente contas explicitamente autorizadas podem acessar a área
    administrativa.
-   Verificar sessão e autorização no servidor para cada operação
    protegida.
-   Não confiar somente em redirecionamentos ou componentes ocultos no
    navegador.
-   Aplicar Row Level Security (RLS) nas tabelas.
-   Visitantes anônimos podem consultar apenas espécies publicadas.
-   Visitantes anônimos não podem criar, editar, excluir ou publicar
    registros.
-   A política de Storage deve impedir que usuários não autorizados
    alterem imagens administrativas.
-   Não expor chaves privilegiadas no cliente.

### 8.3 Variáveis de ambiente

Criar `.env.example` com nomes e valores de exemplo sem segredos:

``` env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

O nome da chave pública deve seguir o formato disponibilizado pelo
projeto Supabase no momento da configuração. A chave de serviço, caso
realmente necessária, deve existir apenas no servidor. Nunca preencher
`.env.example` com credenciais reais.

Adicionar `.env`, `.env.local` e arquivos de segredos ao `.gitignore`.

## 9. Imagens e armazenamento

-   Armazenar imagens no Supabase Storage, não como blobs no banco.
-   Guardar no banco apenas caminho e metadados.
-   Permitir múltiplas imagens por espécie e selecionar uma capa.
-   Exigir texto alternativo para imagens relevantes.
-   Mostrar pré-visualização antes de salvar, quando possível.
-   Informar claramente o resultado de upload, falha ou exclusão.
-   Validar o arquivo no cliente para usabilidade e novamente no
    servidor para segurança.
-   Definir limite inicial de 5 MB por arquivo como regra do projeto,
    ajustável se houver justificativa.
-   Usar formatos comuns como WebP, JPEG ou PNG; validar o conteúdo real
    do arquivo, não apenas o nome.
-   Planejar exclusão de arquivo e registro para evitar imagens órfãs.
-   Não copiar imagens de terceiros sem verificar licença e atribuição.

## 10. Segurança e validação

-   Validar payloads de entrada com Zod ou solução equivalente.
-   Validar e normalizar slugs.
-   Escapar ou renderizar com segurança conteúdo fornecido por usuários.
-   Evitar SQL construído por concatenação de texto.
-   Proteger endpoints administrativos com sessão e autorização no
    servidor.
-   Implementar mensagens de erro que não revelem detalhes internos,
    tokens ou credenciais.
-   Não registrar senhas, tokens ou chaves em logs.
-   Proteger contra upload de arquivos não permitidos.
-   Validar tipos e tamanhos de imagem no servidor.
-   Implementar confirmação para exclusões.
-   Aplicar limites de requisição quando o uso justificar,
    principalmente em importação e upload.
-   Manter dependências atualizadas de forma controlada.

## 11. Acessibilidade, desempenho e SEO

-   Usar HTML semântico e navegação por teclado.
-   Garantir contraste adequado e foco visível.
-   Incluir `alt` nas imagens informativas.
-   Formular mensagens de erro associadas aos campos.
-   Não depender exclusivamente de cor para transmitir estado.
-   Otimizar imagens e evitar carregar galerias inteiras
    desnecessariamente.
-   Usar metadados e títulos claros por página.
-   Criar URLs legíveis e estáveis para espécies.
-   Garantir que páginas públicas possam ser indexadas, enquanto o
    painel não deve ser indexado.
-   Não depender de animações para transmitir informações essenciais.

## 12. Hospedagem e custo

A aplicação será preparada para Vercel e Supabase, priorizando planos
gratuitos no desenvolvimento e no MVP. Plano gratuito não significa
disponibilidade ou custo zero garantidos para sempre.

Antes da publicação: - Conferir limites atuais de banco, armazenamento,
tráfego e funções. - Conferir condições de uso comercial e pessoal da
hospedagem escolhida. - Configurar alertas ou acompanhar consumo. -
Evitar arquivos grandes e chamadas externas desnecessárias. - Documentar
qualquer serviço que possa gerar cobrança. - Não prometer
disponibilidade contínua com base em planos gratuitos.

## 13. Endpoints internos sugeridos

Os caminhos podem ser adaptados, mas a autorização deve permanecer
equivalente.

### Públicos

-   `GET /api/species` --- listar espécies publicadas, com paginação e
    pesquisa.
-   `GET /api/species/[slug]` --- retornar detalhes de uma espécie
    publicada.

### Administrativos

-   `POST /api/admin/import` --- pesquisar/importar dados externos para
    revisão.
-   `POST /api/admin/species` --- criar rascunho.
-   `PATCH /api/admin/species/[id]` --- editar espécie.
-   `DELETE /api/admin/species/[id]` --- excluir espécie, com
    autorização e confirmação.
-   `POST /api/admin/images` --- enviar imagem.
-   `PATCH /api/admin/species/[id]/publish` --- validar e publicar
    espécie.

Cada endpoint administrativo deve validar a sessão, a autorização, o
formato dos dados e as permissões correspondentes. Não confiar no fato
de o endpoint estar sob `/admin` para considerá-lo protegido.

## 14. Critérios técnicos de aceite

-   [ ] Aplicação executa localmente com instruções documentadas.
-   [ ] Build de produção conclui sem erros.
-   [ ] Variáveis de ambiente estão documentadas sem segredos.
-   [ ] Visitantes conseguem consultar apenas espécies publicadas.
-   [ ] Usuário não autorizado não consegue alterar dados via interface
    ou API.
-   [ ] RLS e políticas de Storage estão configuradas e testadas.
-   [ ] Importação apresenta dados para revisão e não publica
    automaticamente.
-   [ ] Dados sem fonte suficiente permanecem vazios ou explicitamente
    desconhecidos.
-   [ ] Uma espécie aceita várias imagens e no máximo uma capa.
-   [ ] Erros de APIs e upload são tratados sem perder dados
    preenchidos.
-   [ ] Documentação explica como configurar banco, autenticação e
    deploy.
-   [ ] Limites e termos dos planos gratuitos foram verificados antes da
    publicação.

## 15. Referências oficiais

-   Next.js: https://nextjs.org/docs
-   TypeScript: https://www.typescriptlang.org/docs/
-   Supabase: https://supabase.com/docs
-   Supabase Auth com Next.js:
    https://supabase.com/docs/guides/auth/server-side/nextjs
-   Supabase Storage: https://supabase.com/docs/guides/storage
-   Supabase RLS:
    https://supabase.com/docs/guides/database/postgres/row-level-security
-   WoRMS REST API: https://www.marinespecies.org/rest/
-   GBIF Species API: https://techdocs.gbif.org/en/openapi/v1/species
-   Vercel: https://vercel.com/docs

Os limites e termos comerciais dos serviços devem ser conferidos
diretamente na documentação oficial no momento de implantação.