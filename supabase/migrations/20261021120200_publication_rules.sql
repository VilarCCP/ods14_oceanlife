-- OceanLife — regras mínimas de publicação, garantidas no banco.
-- Referências: docs/03-painel-administrativo.md §9.3, §11 e §12;
-- docs/decisoes.md (mudança aprovada 5).
--
-- O painel também valida antes de publicar e mostra a lista do que falta.
-- Estas regras são a última barreira: nenhum caminho (painel, API ou SQL de um
-- usuário comum) consegue deixar uma espécie publicada em estado inválido.

-- Lista os impedimentos de publicação de uma espécie. Vazia = pode publicar.
-- Nome popular, nome científico e slug já são garantidos por restrições.
-- Códigos:
--   missing_cover        nenhuma imagem marcada como capa
--   missing_cover_alt    a capa não tem texto alternativo
--   missing_description  sem resumo curto e sem descrição geral
create or replace function public.species_publication_issues(p_species_id uuid)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  v_species public.species%rowtype;
  v_cover public.species_images%rowtype;
  v_issues text[] := array[]::text[];
begin
  select * into v_species from public.species where id = p_species_id;
  if not found then
    return null;
  end if;

  select * into v_cover
  from public.species_images
  where species_id = p_species_id and is_cover
  limit 1;

  if not found then
    v_issues := array_append(v_issues, 'missing_cover');
  elsif coalesce(btrim(v_cover.alt_text), '') = '' then
    v_issues := array_append(v_issues, 'missing_cover_alt');
  end if;

  if coalesce(btrim(v_species.short_description), '') = ''
     and coalesce(btrim(v_species.description), '') = '' then
    v_issues := array_append(v_issues, 'missing_description');
  end if;

  return v_issues;
end;
$$;

comment on function public.species_publication_issues(uuid) is
  'Retorna os impedimentos de publicação (missing_cover, missing_cover_alt, missing_description). Vazio = pode publicar; NULL = espécie não encontrada ou não visível.';

-- Gera o erro padronizado usado pelos gatilhos abaixo.
create or replace function public.assert_species_publishable(p_species_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_published boolean;
  v_issues text[];
begin
  select is_published into v_published from public.species where id = p_species_id;
  -- Espécie removida no mesmo comando (exclusão em cascata) ou não publicada.
  if v_published is null or not v_published then
    return;
  end if;

  v_issues := public.species_publication_issues(p_species_id);
  if cardinality(v_issues) > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'species_not_publishable',
      detail = array_to_string(v_issues, ','),
      hint = 'Uma espécie publicada precisa de capa com texto alternativo e de resumo ou descrição.';
  end if;
end;
$$;

-- Verifica a espécie ao inserir ou alterar.
create or replace function public.species_check_publishable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_species_publishable(new.id);
  return null;
end;
$$;

-- Verifica a espécie dona da imagem ao alterar ou remover imagens.
create or replace function public.species_images_check_publishable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.assert_species_publishable(old.species_id);
  end if;
  if tg_op = 'UPDATE' and new.species_id <> old.species_id then
    perform public.assert_species_publishable(new.species_id);
  end if;
  return null;
end;
$$;

-- Gatilhos de restrição: rodam ao fim de cada comando, depois que todas as
-- linhas foram alteradas. Assim uma troca de capa num único UPDATE é válida.
create constraint trigger species_publishable_check
  after insert or update on public.species
  deferrable initially immediate
  for each row execute function public.species_check_publishable();

create constraint trigger species_images_publishable_check
  after update or delete on public.species_images
  deferrable initially immediate
  for each row execute function public.species_images_check_publishable();

-- Define a capa de uma espécie num único comando: a imagem escolhida vira
-- capa e as demais deixam de ser. Respeita a RLS de quem chama.
create or replace function public.set_species_cover(p_image_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_species_id uuid;
begin
  select species_id into v_species_id from public.species_images where id = p_image_id;
  if v_species_id is null then
    raise exception using errcode = 'P0002', message = 'image_not_found';
  end if;

  update public.species_images
  set is_cover = (id = p_image_id)
  where species_id = v_species_id
    and (is_cover or id = p_image_id);
end;
$$;

comment on function public.set_species_cover(uuid) is
  'Marca a imagem como capa e desmarca a anterior num único comando (doc 03 §9.3).';
