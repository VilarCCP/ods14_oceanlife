-- OceanLife — armazenamento das imagens das espécies.
-- Referências: docs/01-arquitetura-tecnica.md §9, docs/03-painel-administrativo.md §9,
-- docs/decisoes.md (D3, D4).
--
-- Bucket público (decisão D4): os arquivos são servidos pela URL pública, sem
-- política de leitura para visitantes. Como não há política de SELECT para
-- anon/authenticated comuns, ninguém além de administradores consegue LISTAR o
-- bucket — a URL de uma imagem de rascunho não pode ser descoberta.
-- Caminho obrigatório: species/{species_id}/{uuid}.{webp|jpg|jpeg|png}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'species-images',
  'species-images',
  true,
  5242880, -- 5 MB (regra do projeto)
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Caminho válido para uma espécie existente.
create or replace function public.is_valid_species_image_path(object_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    object_name ~ '^species/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|jpeg|png)$'
    and exists (
      select 1 from public.species s
      where s.id::text = (storage.foldername(object_name))[2]
    );
$$;

comment on function public.is_valid_species_image_path(text) is
  'Verdadeiro se o caminho segue species/{species_id}/{uuid}.{ext} e a espécie existe.';

create policy "species-images: administradores listam e leem"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'species-images' and (select public.is_admin()));

create policy "species-images: administradores enviam"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'species-images'
    and (select public.is_admin())
    and public.is_valid_species_image_path(name)
  );

create policy "species-images: administradores substituem"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'species-images' and (select public.is_admin()))
  with check (
    bucket_id = 'species-images'
    and (select public.is_admin())
    and public.is_valid_species_image_path(name)
  );

create policy "species-images: administradores removem"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'species-images' and (select public.is_admin()));
