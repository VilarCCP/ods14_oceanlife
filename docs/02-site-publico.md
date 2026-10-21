# OceanLife --- Especificação do Site Público

**Versão:** 1.0\
**Documento relacionado:** `01-arquitetura-tecnica.md`\
**Objetivo:** descrever as páginas, o conteúdo e o comportamento
esperado da área pública do OceanLife.

------------------------------------------------------------------------

## 1. Objetivo e público

O site público deve apresentar a vida marinha de forma visual, educativa
e fácil de explorar. O usuário deve conseguir encontrar uma espécie,
compreender suas principais características e aprender por que a
conservação dos oceanos é importante.

O público inclui estudantes, professores e pessoas interessadas no
oceano. A interface não deve parecer infantil demais nem exigir
conhecimento científico avançado.

## 2. Princípios de experiência

-   Priorizar clareza, leitura confortável e navegação simples.
-   Utilizar imagens de boa qualidade com direitos de uso confirmados.
-   Dar destaque ao nome popular e apresentar o nome científico de forma
    visível.
-   Evitar blocos longos de texto sem organização.
-   Usar cartões de espécies com informações resumidas.
-   Mostrar claramente quando uma informação não está disponível.
-   Não criar afirmações científicas sem fonte.
-   Funcionar em celular, tablet e desktop.
-   Não exigir login para navegar no catálogo público.
-   Não exibir rascunhos ou conteúdo não publicado.

## 3. Mapa de páginas

  Rota                 Objetivo
  -------------------- ----------------------------------------------------
  `/`                  Página inicial e apresentação do OceanLife
  `/especies`          Catálogo com pesquisa e filtros
  `/especies/[slug]`   Página de detalhes de uma espécie
  `/conservacao`       Conteúdo educativo sobre conservação marinha
  `/sobre`             Explicação do projeto e relação com a ODS 14
  `/admin/*`           Área administrativa, definida no documento próprio

As páginas administrativas devem ser protegidas e não devem aparecer na
navegação pública.

## 4. Navegação global

O cabeçalho deve incluir: - Nome ou marca OceanLife. - Link para
início. - Link para explorar espécies. - Link para conservação. - Link
para sobre o projeto. - Acesso à pesquisa, se compatível com o desenho
da interface.

Requisitos: - O cabeçalho deve funcionar em telas pequenas, com menu
acessível. - O item atual deve ter indicação visual e semântica. - A
navegação deve ser consistente em todas as páginas. - O rodapé deve
apresentar o nome do projeto, links úteis e uma explicação breve sobre
sua finalidade educativa. - Não incluir links administrativos para
visitantes comuns.

## 5. Página inicial (`/`)

### 5.1 Objetivo

Apresentar o projeto rapidamente e direcionar o usuário para a
exploração das espécies.

### 5.2 Seções esperadas

1.  **Hero / apresentação**
    -   Título curto relacionado à descoberta da vida marinha.
    -   Texto explicando que o usuário pode explorar espécies e aprender
        sobre o oceano.
    -   Chamada principal para explorar espécies.
    -   Imagem de destaque com direitos de uso confirmados.
2.  **Pesquisa rápida**
    -   Campo para pesquisar por nome popular ou científico.
    -   Ao enviar, direcionar para `/especies?q=termo` ou comportamento
        equivalente.
    -   Não exigir que o visitante saiba o nome científico.
3.  **Espécies em destaque**
    -   Exibir somente espécies publicadas.
    -   Usar a imagem de capa.
    -   Mostrar nome popular, nome científico e resumo breve.
    -   A seleção pode ser manual ou baseada em um campo explícito de
        destaque; não inventar critério silencioso.
4.  **Aprenda sobre conservação**
    -   Introdução curta a ameaças e proteção dos ecossistemas marinhos.
    -   Link para `/conservacao`.
5.  **Sobre a ODS 14**
    -   Explicação concisa da relação entre o projeto e a ODS 14 ---
        Vida na Água.
    -   Não afirmar que o projeto, por si só, cumpre metas oficiais;
        explicar sua contribuição educativa.

### 5.3 Estados

-   Carregamento: usar estrutura de carregamento sem saltos excessivos
    de layout.
-   Sem espécies publicadas: mostrar mensagem informativa e não cartões
    vazios.
-   Erro ao carregar: mostrar mensagem clara e opção de tentar novamente
    quando aplicável.

## 6. Catálogo (`/especies`)

### 6.1 Lista de espécies

Cada cartão deve conter: - Imagem de capa. - Nome popular. - Nome
científico. - Resumo breve, se cadastrado. - Link acessível para abrir a
página da espécie.

O cartão inteiro pode ser clicável desde que mantenha foco visível e
comportamento acessível. Não mostrar dados internos como IDs, rascunhos
ou fontes administrativas sem necessidade.

### 6.2 Pesquisa

A pesquisa deve aceitar: - Nome popular. - Nome científico. -
Correspondência parcial, quando viável. - Espaços extras antes/depois do
termo sem prejudicar a busca.

Regras: - A busca deve funcionar sem diferenciar maiúsculas e
minúsculas. - A pesquisa vazia deve mostrar o catálogo normalmente. - Ao
pesquisar, manter o termo na URL ou no campo para que o resultado possa
ser compartilhado e recarregado. - Não exibir resultados não
publicados. - Tratar caracteres especiais e consultas sem resultado. -
Se não houver correspondência, mostrar mensagem útil e permitir limpar a
busca.

### 6.3 Filtros

O MVP pode incluir filtros por grupo taxonômico ou tipo de organismo,
desde que o campo esteja preenchido de forma consistente. Não apresentar
filtros que não tenham dados suficientes para funcionar.

Os filtros devem poder ser removidos facilmente e não devem substituir a
pesquisa textual.

### 6.4 Paginação

Se o catálogo crescer, utilizar paginação ou carregamento incremental. A
consulta deve ter limite definido e evitar trazer todo o banco sem
necessidade.

### 6.5 Estados

-   Carregamento.
-   Resultados encontrados.
-   Nenhum resultado.
-   Erro de consulta.
-   Catálogo vazio.

Cada estado deve ser visualmente distinto e compreensível.

## 7. Página de espécie (`/especies/[slug]`)

### 7.1 Cabeçalho da espécie

Exibir: - Nome popular. - Nome científico. - Grupo/classificação, quando
disponível. - Imagem de capa. - Legenda ou crédito, quando aplicável.

### 7.2 Galeria de imagens

-   Mostrar as imagens associadas à espécie em ordem definida no painel.
-   A capa deve aparecer como imagem principal.
-   Imagens adicionais podem ser abertas em tamanho maior se essa
    interação for implementada de forma acessível.
-   Cada imagem informativa deve ter texto alternativo.
-   Mostrar legendas e atribuições quando cadastradas.
-   Se não houver imagem disponível, usar um estado visual de
    substituição; não quebrar a página.

### 7.3 Conteúdo informativo

Apresentar seções apenas quando houver dados. Campos esperados: -
Descrição geral. - Características físicas. - Habitat. - Distribuição
geográfica. - Alimentação. - Comportamento. - Expectativa de vida. -
Importância no ecossistema. - Curiosidades. - Estado de conservação,
risco de extinção e principais ameaças, quando houver fonte confiável.

Não exibir títulos vazios. Para informação importante que não estiver
disponível, mostrar uma mensagem curta como "Informação não disponível
no momento", quando isso ajudar o leitor.

### 7.4 Conservação e fontes

Quando houver informação de conservação: - Identificar a categoria e o
sistema de avaliação, se disponível. - Exibir a fonte e a data de
consulta, quando registradas. - Não tratar dados taxonômicos como
evidência de risco de extinção. - Não transformar ausência de dados em
"baixo risco". - Não apresentar avaliação antiga como se fosse
necessariamente atual.

As fontes podem aparecer em uma seção "Fontes e referências" ao final da
página.

### 7.5 Espécies relacionadas

Pode haver uma seção de espécies relacionadas. No MVP, a relação pode
ser baseada em grupo taxonômico ou seleção manual. Só exibir essa seção
quando existirem registros relacionados publicados.

### 7.6 Página não encontrada

Slug inexistente ou espécie não publicada deve retornar estado de página
não encontrada. Não revelar que um rascunho existe.

## 8. Página de conservação (`/conservacao`)

### 8.1 Objetivo

Explicar, em linguagem simples, problemas que afetam o ambiente marinho
e atitudes que podem contribuir para sua proteção.

### 8.2 Conteúdo sugerido

-   Por que os oceanos são importantes.
-   Poluição por plástico e resíduos.
-   Impactos das atividades humanas.
-   Perda de habitat e biodiversidade.
-   Sobrepesca e outras pressões, quando explicadas com fontes
    adequadas.
-   Relação entre biodiversidade e equilíbrio dos ecossistemas.
-   Atitudes práticas para reduzir impactos.
-   Relação com a ODS 14.

### 8.3 Regras editoriais

-   Separar fatos de recomendações.
-   Evitar números sem fonte, data e contexto.
-   Preferir fontes institucionais, científicas e atualizadas.
-   Não afirmar que uma ação isolada resolve um problema complexo.
-   Manter linguagem acessível e respeitosa.
-   Se o conteúdo tiver referências, listar título, organização, link e
    data de consulta.

O MVP pode manter esse conteúdo estático no código. Um CMS não é
obrigatório nesta etapa, a menos que o escopo seja alterado.

## 9. Página sobre (`/sobre`)

Deve explicar: - O propósito educativo do OceanLife. - A relação com a
ODS 14 --- Vida na Água. - O público a que se destina. - O escopo
inicial e as limitações do projeto. - Que as informações podem variar
conforme as fontes e a data de consulta.

Não afirmar parcerias, certificações ou validações científicas que não
existam.

## 10. Diretrizes visuais

A identidade visual deve transmitir oceano, descoberta, confiança e
educação ambiental.

Diretrizes: - Usar uma paleta coerente com o tema marinho, com contraste
adequado. - Priorizar hierarquia visual clara: títulos, resumos,
informações e fontes. - Usar cartões consistentes e imagens sem
distorção. - Manter espaços e tamanhos de texto confortáveis. - Evitar
excesso de efeitos, animações ou elementos decorativos que atrapalhem a
leitura. - Evitar que a interface dependa apenas de tons de azul para
indicar estados. - Criar estados de hover, foco, carregamento, erro e
desabilitado. - Não utilizar emojis como substitutos de ícones ou
informação essencial.

A implementação visual pode ser refinada durante o desenvolvimento, mas
a navegação e a legibilidade devem permanecer prioritárias.

## 11. Responsividade e acessibilidade

-   Layout funcional em celular, tablet e desktop.
-   Navegação completa por teclado.
-   Foco visível em links, botões e campos.
-   Rótulos associados a campos de pesquisa.
-   Botões com nomes acessíveis.
-   Imagens informativas com texto alternativo.
-   Contraste adequado entre texto e fundo.
-   Não depender apenas de cor, movimento ou posição para comunicar
    significado.
-   Respeitar preferência de redução de movimento.
-   Mensagens de erro compreensíveis e próximas da ação relacionada.

## 12. SEO e compartilhamento

-   Cada espécie publicada deve ter título e descrição adequados.
-   Gerar metadados com base nos dados cadastrados, sem inventar
    informações.
-   Utilizar URLs legíveis e estáveis.
-   Permitir que páginas públicas sejam indexadas.
-   Evitar indexação do painel administrativo.
-   Garantir que a página da espécie tenha conteúdo útil mesmo sem
    JavaScript no cliente quando viável.
-   Imagens de compartilhamento devem respeitar licenças e não ser
    geradas com base em imagens não autorizadas.

## 13. Desempenho e tratamento de erros

-   Otimizar e dimensionar imagens.
-   Evitar consultas repetidas ao banco.
-   Utilizar paginação para listas extensas.
-   Mostrar mensagens úteis para falhas de rede e banco.
-   Não mostrar detalhes técnicos internos ao visitante.
-   Não perder o termo de pesquisa quando uma consulta falhar.
-   Não exibir erros de API externa no site público se a consulta de
    dados já estiver armazenada no banco.

## 14. Critérios de aceite do site público

-   [ ] A página inicial apresenta o projeto e direciona ao catálogo.
-   [ ] O catálogo mostra apenas espécies publicadas.
-   [ ] Pesquisa funciona por nome popular e científico.
-   [ ] A URL preserva o termo de pesquisa quando aplicável.
-   [ ] O catálogo possui estados de carregamento, vazio, sem resultados
    e erro.
-   [ ] A página da espécie exibe nome, capa e campos disponíveis.
-   [ ] A galeria respeita a ordem cadastrada.
-   [ ] Informações ausentes não geram conteúdo inventado nem seções
    vazias.
-   [ ] Informações de conservação exibem fontes quando cadastradas.
-   [ ] Slugs inválidos e espécies não publicadas não revelam rascunhos.
-   [ ] Páginas funcionam em celular, tablet e desktop.
-   [ ] Navegação por teclado e foco visível são funcionais.
-   [ ] O site não exige login para consultar espécies.
-   [ ] O painel não aparece como área pública de navegação.

## 15. Fora do escopo do MVP

Salvo decisão posterior, não incluir: - Login ou perfil de visitante. -
Comentários públicos. - Favoritos sincronizados. - Gamificação,
pontuação ou ranking. - Fórum ou rede social. - Vídeos e animações
complexas. - Mapa interativo de distribuição com precisão geográfica não
validada. - CMS completo para editar todas as páginas institucionais. -
Conteúdo gerado automaticamente e publicado sem revisão.

Esses itens podem ser avaliados em uma versão futura.