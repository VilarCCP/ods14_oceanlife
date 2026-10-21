-- OceanLife — extensões e funções auxiliares.

-- Pesquisa sem acentos (decisão D7).
create extension if not exists unaccent with schema extensions;

-- Versão IMMUTABLE do unaccent, necessária para colunas geradas e índices.
-- O dicionário é fixado explicitamente para que o resultado não dependa do
-- search_path de quem chama.
create or replace function public.immutable_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value);
$$;

comment on function public.immutable_unaccent(text) is
  'unaccent() com dicionário fixo, marcada como IMMUTABLE para uso em colunas geradas.';

-- Normaliza texto para comparação: sem acentos, minúsculas e espaços simples.
create or replace function public.normalize_text(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select lower(regexp_replace(btrim(public.immutable_unaccent(value)), '\s+', ' ', 'g'));
$$;

comment on function public.normalize_text(text) is
  'Remove acentos, converte para minúsculas e reduz espaços repetidos.';

-- Gatilho genérico para manter updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
