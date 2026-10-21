-- Storage: bucket species-images e políticas de storage.objects.
-- A remoção de arquivos é testada pela API do Storage na fase 04, porque o
-- Storage bloqueia DELETE direto em storage.objects.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Preparação ----------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'admin-st@teste.invalid'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000012', 'authenticated', 'authenticated', 'comum-st@teste.invalid');
insert into public.admin_users (user_id) values ('aaaaaaaa-0000-0000-0000-000000000011');
insert into public.species (id, slug, common_name, scientific_name)
values ('f0000000-0000-0000-0000-000000000001', 'teste-storage', 'Storage de teste', 'Fictitia arquivo');

-- Configuração do bucket (D4) ---------------------------------------------------------------
select is(
  (select public from storage.buckets where id = 'species-images'),
  true,
  'bucket species-images existe e é público'
);
select is(
  (select file_size_limit from storage.buckets where id = 'species-images'),
  5242880::bigint,
  'bucket limita arquivos a 5 MB'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'species-images'),
  array['image/webp', 'image/jpeg', 'image/png'],
  'bucket aceita apenas WebP, JPEG e PNG'
);
select policies_are(
  'storage', 'objects',
  array[
    'species-images: administradores listam e leem',
    'species-images: administradores enviam',
    'species-images: administradores substituem',
    'species-images: administradores removem'
  ],
  'storage.objects tem apenas as políticas do projeto'
);
select policy_cmd_is('storage', 'objects', 'species-images: administradores removem', 'delete',
  'existe política de DELETE restrita');
select policy_roles_are('storage', 'objects', 'species-images: administradores removem', array['authenticated'],
  'a política de DELETE vale só para authenticated (e exige is_admin)');

-- Visitante anônimo -------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('species-images', 'species/f0000000-0000-0000-0000-000000000001/f1000000-0000-0000-0000-000000000001.webp')$$,
  '42501', null, 'anon: não envia arquivo'
);

reset role;

-- Usuário comum ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000012","role":"authenticated"}', true);

select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('species-images', 'species/f0000000-0000-0000-0000-000000000001/f1000000-0000-0000-0000-000000000002.webp')$$,
  '42501', null, 'comum: não envia arquivo'
);

reset role;

-- Administrador ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000011","role":"authenticated"}', true);

select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('species-images', 'species/f0000000-0000-0000-0000-000000000001/f1000000-0000-0000-0000-000000000003.webp')$$,
  'admin: envia arquivo no caminho correto'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('species-images', 'outra-pasta/arquivo.webp')$$,
  '42501', null, 'admin: caminho fora do padrão é rejeitado'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('species-images', 'species/99999999-9999-9999-9999-999999999999/f1000000-0000-0000-0000-000000000004.webp')$$,
  '42501', null, 'admin: caminho de espécie inexistente é rejeitado'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('species-images', 'species/f0000000-0000-0000-0000-000000000001/f1000000-0000-0000-0000-000000000005.gif')$$,
  '42501', null, 'admin: extensão não permitida é rejeitada'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'species-images' and name like 'species/f0000000-%'),
  1::bigint,
  'admin: lista o arquivo enviado'
);

reset role;

-- Listagem por usuário comum ------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000012","role":"authenticated"}', true);

select is_empty(
  $$select 1 from storage.objects where bucket_id = 'species-images'$$,
  'comum: não consegue listar o bucket (URLs de rascunho não são descobertas)'
);

reset role;

select * from finish();
rollback;
