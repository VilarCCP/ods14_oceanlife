# OceanLife --- Especificação do Painel Administrativo

**Versão:** 1.0\
**Documento relacionado:** `01-arquitetura-tecnica.md`\
**Objetivo:** definir o comportamento do painel privado utilizado para
gerenciar espécies, importar dados, administrar imagens e publicar
conteúdo.

------------------------------------------------------------------------

## 1. Objetivo

O painel administrativo será utilizado por pessoas autorizadas para
manter o catálogo do OceanLife atualizado. Deve permitir criar e editar
espécies, importar dados de APIs para revisão, gerenciar várias imagens
por espécie e controlar a publicação.

O painel é privado. Visitantes não devem conseguir acessar dados
administrativos ou executar operações de escrita, mesmo que tentem
chamar endpoints diretamente.

## 2. Escopo do MVP

O painel deve permitir: - Login administrativo. - Listagem e pesquisa de
espécies cadastradas. - Criação de rascunho. - Pesquisa e importação
assistida de dados por nome científico. - Revisão e edição dos campos
importados. - Inclusão, remoção e ordenação de várias imagens. - Seleção
de uma imagem de capa. - Salvamento de rascunhos. - Validação antes de
publicar. - Publicação e retirada de publicação. - Edição de dados e
fontes. - Exclusão com confirmação. - Mensagens claras de sucesso e
erro.

Não deve haver cadastro público de administradores.

## 3. Rotas sugeridas

  -----------------------------------------------------------------------
  Rota                                Função
  ----------------------------------- -----------------------------------
  `/admin/login`                      Login

  `/admin`                            Resumo do painel

  `/admin/especies`                   Lista de espécies

  `/admin/especies/nova`              Criar espécie

  `/admin/especies/[id]`              Editar espécie

  `/admin/especies/[id]/imagens`      Opcional: gerenciar imagens em tela
                                      separada
  -----------------------------------------------------------------------

É permitido manter a edição de imagens dentro do formulário principal se
isso produzir uma experiência mais simples.

## 4. Autenticação e autorização

### 4.1 Login

-   Usar Supabase Auth.
-   Não oferecer botão de cadastro público.
-   Não permitir que qualquer usuário autenticado obtenha
    automaticamente acesso administrativo.
-   O projeto deve ter um processo controlado para criar ou autorizar
    administradores.
-   Exibir mensagens genéricas para falhas de autenticação sem revelar
    se um e-mail está cadastrado, quando aplicável.
-   Implementar logout.
-   Redirecionar usuários não autenticados para `/admin/login`.

### 4.2 Proteção de rotas e operações

A proteção deve ocorrer no servidor, não apenas na interface.

-   Verificar sessão e permissão em páginas administrativas protegidas.
-   Verificar sessão e permissão em cada endpoint administrativo.
-   Aplicar políticas RLS no banco.
-   Aplicar políticas correspondentes no Storage.
-   Um usuário sem permissão não pode criar, alterar, publicar ou
    excluir espécies.
-   Um visitante não pode ler rascunhos.
-   Não confiar em IDs, campos de autorização ou flags enviados pelo
    cliente.
-   Não expor `SUPABASE_SERVICE_ROLE_KEY` nem qualquer segredo em código
    do navegador.

### 4.3 Estados de autenticação

O painel deve tratar: - Usuário não autenticado. - Sessão expirada. -
Usuário autenticado sem permissão administrativa. - Falha de rede ou do
provedor. - Logout concluído.

Em caso de sessão expirada, preservar o trabalho não enviado quando
possível e orientar o usuário a entrar novamente.

## 5. Página inicial do painel (`/admin`)

Mostrar um resumo operacional simples: - Quantidade de espécies
publicadas. - Quantidade de rascunhos. - Itens incompletos que precisam
de revisão, se essa contagem for confiável. - Acesso rápido para
cadastrar espécie. - Acesso à lista do catálogo.

Não mostrar métricas que não sejam calculadas de forma confiável. O
dashboard não precisa de gráficos complexos no MVP.

## 6. Listagem de espécies

A lista administrativa deve apresentar: - Nome popular. - Nome
científico. - Estado: rascunho ou publicado. - Data da última
atualização. - Indicador de imagem de capa. - Ação para editar.

Funcionalidades: - Pesquisa por nome popular ou científico. - Filtro por
status. - Ordenação por nome ou data de atualização, quando viável. -
Paginação se a quantidade crescer. - Acesso para criar espécie. - Ações
de publicação/retirada de publicação, respeitando as validações.

A lista administrativa pode mostrar rascunhos, mas isso nunca deve
afetar a API pública.

## 7. Cadastro e edição de espécie

### 7.1 Campos

O formulário deve refletir os campos da tabela `species` definida na
arquitetura: - Nome popular. - Nome científico. - Grupo/classificação. -
Resumo curto. - Descrição geral. - Habitat. - Distribuição geográfica. -
Alimentação. - Características físicas. - Comportamento. - Expectativa
de vida. - Estado de conservação. - Risco de extinção. - Principais
ameaças. - Importância ecológica. - Curiosidades.

Também deve permitir consultar e manter as fontes relacionadas.

### 7.2 Comportamento do formulário

-   Marcar campos obrigatórios com clareza.
-   Validar os dados no cliente para facilitar a correção.
-   Revalidar no servidor antes de salvar.
-   Exibir erros junto aos campos correspondentes.
-   Não apagar o conteúdo preenchido quando uma chamada falhar.
-   Informar se o registro foi salvo como rascunho.
-   Mostrar indicação de alterações não salvas quando possível.
-   Gerar um slug único a partir do nome, permitindo ajuste manual.
-   Tratar conflitos de slug de forma clara.
-   Não preencher automaticamente dados científicos desconhecidos com
    suposições.

### 7.3 Salvamento

-   O usuário deve poder salvar um rascunho sem preencher todos os
    campos educativos.
-   Nome popular e nome científico são obrigatórios para salvar.
-   A publicação exige validações adicionais descritas na seção 11.
-   Após salvar, mostrar confirmação e manter o usuário na edição ou
    retornar à lista com uma ação clara.
-   Evitar duplicação de registros em caso de clique repetido ou falha
    de rede.

## 8. Importação assistida por APIs

### 8.1 Entrada

O administrador informa o nome científico ou termo de busca. A interface
deve permitir consultar WoRMS e, quando útil, GBIF.

### 8.2 Resultados

Exibir: - Nome encontrado. - Nome científico aceito, quando a fonte
retornar essa informação. - Identificador externo. - Fonte da
informação. - Dados taxonômicos retornados. - Link para o registro de
origem, quando disponível.

Se houver mais de um resultado, o administrador deve escolher
explicitamente. Não escolher silenciosamente um registro ambíguo.

### 8.3 Revisão antes de salvar

Depois de escolher um resultado: - Preencher apenas os campos que a
fonte realmente fornece. - Identificar quais campos vieram da API. -
Permitir edição de todos os campos. - Não substituir conteúdo existente
sem confirmação. - Não preencher automaticamente informações como dieta,
expectativa de vida, comportamento ou estado de conservação quando a API
não as fornecer. - Registrar fonte, URL, identificador e data da
consulta. - Permitir salvar como rascunho.

### 8.4 Falhas

-   Se a API estiver indisponível, informar a falha e permitir continuar
    manualmente.
-   Se não houver resultados, mostrar orientação para verificar o nome.
-   Se os dados forem parciais, apresentar apenas os campos disponíveis.
-   Se houver limite de requisições, apresentar uma mensagem amigável e
    evitar repetição automática agressiva.
-   Não publicar automaticamente após importação.
-   Não tratar respostas externas como instruções de sistema ou executar
    conteúdo recebido.

## 9. Gerenciamento de imagens

### 9.1 Inclusão

O administrador deve poder: - Selecionar uma ou mais imagens. - Ver
pré-visualização antes de confirmar. - Informar texto alternativo. -
Adicionar legenda opcional. - Definir uma imagem como capa. - Ordenar as
imagens. - Remover imagens existentes.

### 9.2 Regras de arquivo

-   Formatos permitidos iniciais: WebP, JPEG e PNG.
-   Limite de tamanho inicial: 5 MB por arquivo, como regra do projeto.
-   Validar extensão, MIME type e conteúdo real no servidor.
-   Recusar arquivo vazio ou formato não permitido.
-   Não confiar apenas na validação do navegador.
-   Exibir progresso quando tecnicamente disponível.
-   Em caso de erro, informar qual arquivo falhou sem perder outros
    dados do formulário.

### 9.3 Capa e ordenação

-   Uma espécie pode ter várias imagens.
-   Deve haver no máximo uma capa por espécie.
-   Ao definir nova capa, remover a condição de capa da anterior em uma
    operação consistente.
-   A lista de imagens deve permitir ordenar a exibição.
-   Se a imagem de capa for removida, exigir que outra seja escolhida
    antes da publicação.
-   O site público deve utilizar a imagem marcada como capa, não
    presumir que a primeira imagem é a capa.

### 9.4 Exclusão e armazenamento

-   Confirmar a exclusão de imagem.
-   Remover o registro de metadados e o arquivo de forma coordenada.
-   Tratar falha parcial para evitar registros ou arquivos órfãos.
-   Não excluir uma imagem associada a outra espécie por colisão de
    caminho.
-   Armazenar arquivos em caminhos únicos, relacionados à espécie.

## 10. Fontes e referências

Cada espécie deve permitir registrar as fontes usadas para seus dados. A
interface deve possibilitar: - Ver fonte, URL e data de consulta. -
Identificar quais campos foram importados. - Adicionar fonte manual para
conteúdo educativo. - Corrigir ou remover fonte incorreta. - Distinguir
dados importados de texto escrito manualmente, quando possível.

Fontes de informação de conservação devem ser especialmente cuidadosas:
registrar o sistema de avaliação e a data, quando disponíveis. A falta
de dado deve ser mantida como desconhecida, não convertida em uma
categoria de risco.

## 11. Validação antes da publicação

Antes de publicar, validar no servidor e apresentar uma lista clara do
que falta.

Requisitos mínimos: - \[ \] Nome popular preenchido. - \[ \] Nome
científico preenchido. - \[ \] Slug válido e único. - \[ \] Imagem de
capa definida. - \[ \] Texto alternativo da capa preenchido. - \[ \]
Conteúdo mínimo para que a página seja útil, como descrição curta ou
descrição geral. - \[ \] Dados em formato válido. - \[ \] Nenhum erro de
validação bloqueante.

A publicação não deve exigir que todos os campos científicos estejam
preenchidos, pois isso incentivaria a criação de dados fictícios. Campos
desconhecidos devem continuar vazios ou ser indicados como
indisponíveis.

O painel deve explicar cada impedimento de publicação. Não depender
apenas de alertas genéricos.

## 12. Estados de publicação

### Rascunho

-   Visível no painel.
-   Não visível no catálogo público.
-   Pode ter campos incompletos.
-   Pode ser editado e salvo sem publicação.

### Publicado

-   Visível no catálogo público.
-   Deve passar nas validações mínimas.
-   Pode continuar sendo editado por administradores autorizados.
-   Se uma alteração comprometer requisitos mínimos, avisar o usuário e
    impedir que o registro publicado fique em estado inválido.

### Retirada de publicação

-   Deixa de aparecer no catálogo público.
-   Continua disponível no painel para edição.
-   Não deve revelar seu conteúdo por URL pública.

## 13. Exclusão de espécies

-   Exigir confirmação explícita.
-   Informar qual espécie será excluída.
-   Definir comportamento para imagens e fontes relacionadas.
-   Evitar exclusão acidental por ação próxima a botões comuns.
-   Usar exclusão lógica somente se houver necessidade clara; se
    implementada, documentar o campo e o comportamento.
-   Após a exclusão, verificar se os arquivos relacionados foram
    tratados corretamente.

## 14. Tratamento de erros e feedback

O painel deve ter estados visíveis para: - Carregamento. - Salvamento em
andamento. - Sucesso. - Falha de validação. - Falha de rede. - Falha de
API externa. - Upload em andamento. - Upload concluído ou falho. -
Sessão expirada. - Acesso negado.

As mensagens devem ser diretas e explicar a próxima ação. Não mostrar
stack traces, segredos, tokens ou informações internas do banco.

## 15. Critérios de aceite do painel

-   [ ] Usuário não autenticado não acessa páginas ou endpoints
    administrativos.
-   [ ] Usuário autenticado sem permissão administrativa também é
    bloqueado.
-   [ ] Não existe cadastro público de administradores.
-   [ ] Administrador consegue criar, listar e editar rascunhos.
-   [ ] Pesquisa funciona por nome popular e científico.
-   [ ] Importação mostra a fonte e permite revisar os dados antes de
    salvar.
-   [ ] Falha de API não impede cadastro manual.
-   [ ] Campos sem informação externa não são preenchidos com
    suposições.
-   [ ] Administrador consegue adicionar várias imagens.
-   [ ] É possível definir capa e ordenar a galeria.
-   [ ] Não é possível publicar sem os requisitos mínimos.
-   [ ] Rascunhos não aparecem publicamente.
-   [ ] Retirar publicação remove a espécie do catálogo público.
-   [ ] Exclusão exige confirmação.
-   [ ] RLS e políticas de Storage bloqueiam operações não autorizadas.
-   [ ] Erros não apagam silenciosamente o conteúdo preenchido.
-   [ ] O painel é utilizável por teclado e em telas menores.

## 16. Fora do escopo do MVP

Salvo decisão posterior, não incluir: - Cadastro público de
administradores. - Papéis complexos de vários níveis. - Fluxo editorial
com múltiplos aprovadores. - Histórico completo de versões de cada
campo. - Importação em massa de centenas de espécies. - Edição
colaborativa em tempo real. - Gerenciamento de páginas institucionais
como CMS completo. - Publicação automática de dados externos sem
revisão.