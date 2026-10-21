-- Restrições, colunas geradas e regras de publicação.
-- Roda como superusuário (sem RLS): testa o que o banco garante sozinho.
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

-- Espécie base -------------------------------------------------------------
insert into public.species (id, slug, common_name, scientific_name)
values ('11111111-1111-1111-1111-111111111111', 'teste-schema-1', 'Teste Schema', 'Fictítia   Exemplaris ');

-- Slug e nomes ---------------------------------------------------------------
select throws_ok(
  $$insert into public.species (slug, common_name, scientific_name) values ('teste-schema-1', 'X', 'Y')$$,
  '23505', null, 'slug duplicado é rejeitado'
);
select throws_ok(
  $$insert into public.species (slug, common_name, scientific_name) values ('Slug Inválido', 'X', 'Y')$$,
  '23514', null, 'slug fora do formato é rejeitado'
);
select throws_ok(
  $$insert into public.species (slug, common_name, scientific_name) values ('teste-branco', '   ', 'Y')$$,
  '23514', null, 'nome popular em branco é rejeitado'
);
select throws_ok(
  $$insert into public.species (slug, common_name, scientific_name) values ('teste-nulo', 'X', null)$$,
  '23502', null, 'nome científico ausente é rejeitado'
);

-- Colunas geradas -------------------------------------------------------------
select is(
  (select scientific_name_normalized from public.species where slug = 'teste-schema-1'),
  'fictitia exemplaris',
  'nome científico normalizado remove acentos, maiúsculas e espaços extras'
);
select is(
  (select search_text from public.species where slug = 'teste-schema-1'),
  'teste schema fictitia exemplaris',
  'texto de pesquisa combina os dois nomes normalizados'
);

-- Duplicidade (mudança aprovada 9) -------------------------------------------
update public.species set worms_aphia_id = 999001, gbif_usage_key = 888001 where slug = 'teste-schema-1';
select throws_ok(
  $$insert into public.species (slug, common_name, scientific_name, worms_aphia_id) values ('teste-dup-worms', 'X', 'Y', 999001)$$,
  '23505', null, 'mesmo identificador WoRMS é rejeitado'
);
select throws_ok(
  $$insert into public.species (slug, common_name, scientific_name, gbif_usage_key) values ('teste-dup-gbif', 'X', 'Y', 888001)$$,
  '23505', null, 'mesmo identificador GBIF é rejeitado'
);
select lives_ok(
  $$insert into public.species (slug, common_name, scientific_name) values ('teste-mesmo-nome', 'Outro', 'fictitia exemplaris')$$,
  'nome científico repetido é permitido no banco (o painel avisa e pede confirmação)'
);

-- Conservação (D9) -------------------------------------------------------------
select throws_ok(
  $$update public.species set conservation_category = 'XX' where slug = 'teste-schema-1'$$,
  '23514', null, 'categoria de conservação desconhecida é rejeitada'
);
select throws_ok(
  $$update public.species set conservation_category = 'EN' where slug = 'teste-schema-1'$$,
  '23514', null, 'categoria sem sistema, fonte e data é rejeitada'
);
select lives_ok(
  $$update public.species set conservation_category = 'EN', conservation_system = 'Sistema fictício de teste',
      conservation_source_url = 'https://exemplo.invalid/avaliacao', conservation_accessed_at = '2026-10-21'
    where slug = 'teste-schema-1'$$,
  'categoria com sistema, fonte e data é aceita'
);

-- Imagens ------------------------------------------------------------------------
select throws_ok(
  $$insert into public.species_images (species_id, storage_path)
    values ('11111111-1111-1111-1111-111111111111', 'species/22222222-2222-2222-2222-222222222222/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.webp')$$,
  '23514', null, 'caminho de imagem de outra espécie é rejeitado'
);
select throws_ok(
  $$insert into public.species_images (species_id, storage_path)
    values ('11111111-1111-1111-1111-111111111111', 'species/11111111-1111-1111-1111-111111111111/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.gif')$$,
  '23514', null, 'extensão de imagem não permitida é rejeitada'
);
select lives_ok(
  $$insert into public.species_images (id, species_id, storage_path, alt_text, is_cover, display_order) values
    ('a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
     'species/11111111-1111-1111-1111-111111111111/a1111111-0000-0000-0000-000000000001.webp', 'Imagem fictícia 1', true, 0),
    ('a1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
     'species/11111111-1111-1111-1111-111111111111/a1111111-0000-0000-0000-000000000002.jpg', 'Imagem fictícia 2', false, 1)$$,
  'várias imagens com uma capa são aceitas'
);
select throws_ok(
  $$update public.species_images set is_cover = true where id = 'a1111111-0000-0000-0000-000000000002'$$,
  '23P01', null, 'segunda capa para a mesma espécie é rejeitada'
);
select lives_ok(
  $$select public.set_species_cover('a1111111-0000-0000-0000-000000000002')$$,
  'set_species_cover troca a capa num único comando'
);
select results_eq(
  $$select id from public.species_images where species_id = '11111111-1111-1111-1111-111111111111' and is_cover$$,
  $$values ('a1111111-0000-0000-0000-000000000002'::uuid)$$,
  'após a troca existe exatamente uma capa, a nova'
);

-- Publicação ----------------------------------------------------------------------
select is(
  public.species_publication_issues('11111111-1111-1111-1111-111111111111'),
  array['missing_description'],
  'impedimentos listam a falta de descrição'
);
select throws_ok(
  $$update public.species set is_published = true where slug = 'teste-schema-1'$$,
  'P0001', 'species_not_publishable', 'publicar sem descrição é bloqueado'
);
update public.species set short_description = 'Resumo fictício.' where slug = 'teste-schema-1';
select lives_ok(
  $$update public.species set is_published = true where slug = 'teste-schema-1'$$,
  'com capa, texto alternativo e resumo a publicação é aceita'
);
select isnt(
  (select published_at from public.species where slug = 'teste-schema-1'),
  null,
  'published_at é preenchido ao publicar'
);
select throws_ok(
  $$delete from public.species_images where id = 'a1111111-0000-0000-0000-000000000002'$$,
  'P0001', 'species_not_publishable', 'remover a capa de espécie publicada é bloqueado'
);
select throws_ok(
  $$update public.species_images set alt_text = null where id = 'a1111111-0000-0000-0000-000000000002'$$,
  'P0001', 'species_not_publishable', 'apagar o texto alternativo da capa de espécie publicada é bloqueado'
);
select throws_ok(
  $$update public.species set short_description = null where slug = 'teste-schema-1'$$,
  'P0001', 'species_not_publishable', 'apagar o único texto de espécie publicada é bloqueado'
);
select lives_ok(
  $$select public.set_species_cover('a1111111-0000-0000-0000-000000000001')$$,
  'trocar a capa de espécie publicada por outra válida é permitido'
);
select lives_ok(
  $$update public.species set is_published = false where slug = 'teste-schema-1'$$,
  'retirar a publicação é sempre permitido'
);
select is(
  (select published_at from public.species where slug = 'teste-schema-1'),
  null,
  'published_at é limpo ao retirar a publicação'
);

-- Exclusão em cascata e grupos -------------------------------------------------------
delete from public.species where slug = 'teste-schema-1';
select is(
  (select count(*) from public.species_images where species_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint,
  'excluir a espécie remove seus registros de imagem'
);
select is(
  (select count(*) from public.species_groups),
  7::bigint,
  'os sete grupos educativos (D8) existem'
);

select * from finish();
rollback;
