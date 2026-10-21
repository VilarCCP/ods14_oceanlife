-- Autorização: RLS e privilégios para quatro perfis.
--   anon               visitante sem login
--   comum              usuário autenticado SEM permissão administrativa
--   admin              usuário presente em admin_users
--   (acesso direto)    as mesmas operações que a API faria, feitas em SQL
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

-- Preparação (superusuário) ------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@teste.invalid'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'comum@teste.invalid');

insert into public.admin_users (user_id, note) values ('aaaaaaaa-0000-0000-0000-000000000001', 'admin de teste');

insert into public.species (id, slug, common_name, scientific_name, short_description) values
  ('c0000000-0000-0000-0000-000000000001', 'teste-rls-publicada', 'Publicada de teste', 'Fictitia publica', 'Resumo fictício.'),
  ('c0000000-0000-0000-0000-000000000002', 'teste-rls-rascunho', 'Rascunho de teste', 'Fictitia occulta', null);

insert into public.species_images (id, species_id, storage_path, alt_text, is_cover) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'species/c0000000-0000-0000-0000-000000000001/d0000000-0000-0000-0000-000000000001.webp', 'Imagem fictícia', true),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002',
   'species/c0000000-0000-0000-0000-000000000002/d0000000-0000-0000-0000-000000000002.webp', 'Imagem fictícia', true);

insert into public.species_sources (species_id, provider, reference_title, accessed_at) values
  ('c0000000-0000-0000-0000-000000000001', 'manual', 'Fonte fictícia publicada', '2026-10-21'),
  ('c0000000-0000-0000-0000-000000000002', 'manual', 'Fonte fictícia rascunho', '2026-10-21');

update public.species set is_published = true where id = 'c0000000-0000-0000-0000-000000000001';

-- RLS habilitada em todas as tabelas ------------------------------------------------
select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.admin_users'::regclass, 'public.species_groups'::regclass, 'public.species'::regclass,
                 'public.species_images'::regclass, 'public.species_sources'::regclass)),
  'RLS está habilitada em todas as tabelas públicas'
);

-- ===================================================================================
-- Visitante anônimo
-- ===================================================================================
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select results_eq(
  $$select id from public.species where id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')$$,
  $$values ('c0000000-0000-0000-0000-000000000001'::uuid)$$,
  'anon: vê apenas a espécie publicada'
);
select is_empty(
  $$select 1 from public.species where slug = 'teste-rls-rascunho'$$,
  'anon: não encontra o rascunho nem pelo slug'
);
select results_eq(
  $$select species_id from public.species_images where species_id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')$$,
  $$values ('c0000000-0000-0000-0000-000000000001'::uuid)$$,
  'anon: vê apenas imagens de espécies publicadas'
);
select results_eq(
  $$select species_id from public.species_sources where species_id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')$$,
  $$values ('c0000000-0000-0000-0000-000000000001'::uuid)$$,
  'anon: vê apenas fontes de espécies publicadas'
);
select throws_ok(
  $$insert into public.species (slug, common_name, scientific_name) values ('anon-invasor', 'X', 'Y')$$,
  '42501', null, 'anon: não cria espécie'
);
select throws_ok(
  $$update public.species set common_name = 'alterado' where id = 'c0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'anon: não altera espécie'
);
select throws_ok(
  $$delete from public.species where id = 'c0000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'anon: não exclui espécie'
);
select throws_ok(
  $$insert into public.admin_users (user_id) values ('bbbbbbbb-0000-0000-0000-000000000002')$$,
  '42501', null, 'anon: não cria administrador'
);
select is(public.is_admin(), false, 'anon: is_admin() é falso');
select throws_ok(
  $$select public.set_species_cover('d0000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'anon: não executa set_species_cover'
);

reset role;

-- ===================================================================================
-- Usuário autenticado sem permissão administrativa
-- ===================================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is(public.is_admin(), false, 'comum: is_admin() é falso');
select results_eq(
  $$select id from public.species where id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')$$,
  $$values ('c0000000-0000-0000-0000-000000000001'::uuid)$$,
  'comum: vê apenas a espécie publicada'
);
select throws_ok(
  $$insert into public.species (slug, common_name, scientific_name) values ('comum-invasor', 'X', 'Y')$$,
  '42501', null, 'comum: não cria espécie'
);
select lives_ok(
  $$update public.species set common_name = 'alterado pelo comum' where id = 'c0000000-0000-0000-0000-000000000001'$$,
  'comum: UPDATE não gera erro, mas não deve alterar nada (verificado abaixo)'
);
select lives_ok(
  $$delete from public.species where id = 'c0000000-0000-0000-0000-000000000001'$$,
  'comum: DELETE não gera erro, mas não deve excluir nada (verificado abaixo)'
);
select lives_ok(
  $$update public.species set is_published = true where id = 'c0000000-0000-0000-0000-000000000002'$$,
  'comum: tentativa de publicar rascunho não gera erro, mas não deve publicar (verificado abaixo)'
);
select throws_ok(
  $$insert into public.species_images (species_id, storage_path) values ('c0000000-0000-0000-0000-000000000002',
    'species/c0000000-0000-0000-0000-000000000002/e0000000-0000-0000-0000-000000000009.webp')$$,
  '42501', null, 'comum: não inclui imagem'
);
select throws_ok(
  $$insert into public.species_sources (species_id, provider, reference_title, accessed_at)
    values ('c0000000-0000-0000-0000-000000000001', 'manual', 'x', '2026-10-21')$$,
  '42501', null, 'comum: não inclui fonte'
);
select throws_ok(
  $$insert into public.admin_users (user_id) values ('bbbbbbbb-0000-0000-0000-000000000002')$$,
  '42501', null, 'comum: não consegue se promover a administrador'
);
select is_empty(
  $$select 1 from public.admin_users$$,
  'comum: não vê nenhuma linha de admin_users'
);
select throws_ok(
  $$select public.set_species_cover('d0000000-0000-0000-0000-000000000002')$$,
  'P0002', 'image_not_found', 'comum: set_species_cover não enxerga imagem de rascunho'
);

reset role;

-- Conferência como superusuário: nada mudou.
select is(
  (select common_name from public.species where id = 'c0000000-0000-0000-0000-000000000001'),
  'Publicada de teste',
  'comum: a espécie publicada não foi alterada'
);
select is(
  (select is_published from public.species where id = 'c0000000-0000-0000-0000-000000000002'),
  false,
  'comum: o rascunho continua não publicado'
);

-- ===================================================================================
-- Administrador
-- ===================================================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(public.is_admin(), true, 'admin: is_admin() é verdadeiro');
select results_eq(
  $$select id from public.species where id in ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002') order by id$$,
  $$values ('c0000000-0000-0000-0000-000000000001'::uuid), ('c0000000-0000-0000-0000-000000000002'::uuid)$$,
  'admin: vê publicadas e rascunhos'
);
select results_eq(
  $$select user_id from public.admin_users$$,
  $$values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid)$$,
  'admin: vê apenas a própria linha em admin_users'
);
select lives_ok(
  $$insert into public.species (id, slug, common_name, scientific_name)
    values ('c0000000-0000-0000-0000-000000000003', 'teste-rls-nova', 'Nova de teste', 'Fictitia nova')$$,
  'admin: cria rascunho'
);
select lives_ok(
  $$update public.species set habitat = 'Texto fictício' where id = 'c0000000-0000-0000-0000-000000000002'$$,
  'admin: edita rascunho'
);
select lives_ok(
  $$insert into public.species_images (species_id, storage_path, alt_text)
    values ('c0000000-0000-0000-0000-000000000003',
            'species/c0000000-0000-0000-0000-000000000003/e0000000-0000-0000-0000-000000000003.png', 'Imagem fictícia')$$,
  'admin: inclui imagem'
);
select lives_ok(
  $$insert into public.species_sources (species_id, provider, source_url, accessed_at)
    values ('c0000000-0000-0000-0000-000000000003', 'manual', 'https://exemplo.invalid/fonte', '2026-10-21')$$,
  'admin: inclui fonte'
);
select is(
  public.species_publication_issues('c0000000-0000-0000-0000-000000000003'),
  array['missing_cover', 'missing_description'],
  'admin: consulta os impedimentos de publicação de um rascunho'
);
select throws_ok(
  $$update public.species set is_published = true where id = 'c0000000-0000-0000-0000-000000000003'$$,
  'P0001', 'species_not_publishable', 'admin: também não publica espécie incompleta'
);
select throws_ok(
  $$insert into public.admin_users (user_id) values ('bbbbbbbb-0000-0000-0000-000000000002')$$,
  '42501', null, 'admin: não cria outros administradores pela API (só por SQL/migração)'
);
select lives_ok(
  $$delete from public.species where id = 'c0000000-0000-0000-0000-000000000003'$$,
  'admin: exclui espécie'
);

reset role;

select is_empty(
  $$select 1 from public.species where id = 'c0000000-0000-0000-0000-000000000003'$$,
  'admin: a exclusão foi efetivada'
);

select * from finish();
rollback;
