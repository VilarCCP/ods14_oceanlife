# Instruções para assistentes de código — OceanLife

Leia antes de alterar o projeto.

## Fontes de verdade

1. `docs/decisoes.md` — decisões aprovadas. Prevalece sobre o texto v1.0 dos demais.
2. `docs/00-escopo.md`, `docs/01-arquitetura-tecnica.md`, `docs/02-site-publico.md`,
   `docs/03-painel-administrativo.md`.

Não implemente funcionalidade fora do escopo documentado sem registrar a decisão em
`docs/decisoes.md` e obter aprovação.

## Regras inegociáveis

- **Não inventar dados científicos.** Campo sem fonte fica vazio ou como
  "Informação não disponível". Não escrever descrições, curiosidades, estados de
  conservação ou números sem fonte fornecida pela equipe.
- **Nunca publicar automaticamente** dados importados (WoRMS, GBIF ou outros).
- **Nada está pronto sem verificação.** Toda funcionalidade precisa de teste
  automatizado ou verificação manual registrada.
- Seeds contêm apenas registros obviamente fictícios ("Espécie de teste A") e nunca
  vão para produção.
- Nenhum segredo no código ou no Git. A chave de serviço do Supabase não é usada (D2).
- Autorização sempre verificada no servidor e reforçada pela RLS.

## Convenções

- Next.js App Router; Server Components por padrão, Client Components só quando
  houver estado, eventos ou APIs do navegador.
- Regras de negócio e integrações em `src/services/`; validação com Zod em
  `src/lib/validation/`; acesso ao Supabase em `src/lib/supabase/`.
- Importações internas com o alias `@/` (aponta para `src/`).
- Interface e mensagens em português do Brasil.
- Não adicionar dependências sem necessidade concreta; versões exatas.

## Verificação

Antes de abrir um pull request: `npm run verify`
(segredos, formatação, lint, tipos, testes e build). O CI roda a mesma sequência.

## Git

- Trabalhe numa branch por fase ou funcionalidade e abra pull request para a `main`.
- Mensagens de commit em português, no formato `tipo: descrição`
  (`feat`, `fix`, `docs`, `chore`, `test`, `refactor`).
