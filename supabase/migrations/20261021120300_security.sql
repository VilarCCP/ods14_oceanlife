-- OceanLife — autorização: função is_admin(), RLS e privilégios.
-- Referências: docs/01-arquitetura-tecnica.md §8.2, docs/03-painel-administrativo.md §4,
-- docs/decisoes.md (D1, D2).
--
-- Regras:
--   * Visitantes (anon) e usuários autenticados sem permissão leem apenas
--     espécies publicadas e suas imagens/fontes.
--   * Somente administradores (tabela admin_users) leem rascunhos e escrevem.
--   * Ninguém consegue se promover a administrador pela API.

-- ---------------------------------------------------------------------------
-- is_admin()
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER para consultar admin_users sem depender da RLS dessa tabela.
-- search_path vazio e nomes qualificados evitam sequestro de objetos.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

comment on function public.is_admin() is
  'Verdadeiro se o usuário da sessão está em admin_users (decisão D1).';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.admin_users enable row level security;
alter table public.species_groups enable row level security;
alter table public.species enable row level security;
alter table public.species_images enable row level security;
alter table public.species_sources enable row level security;

-- admin_users: cada usuário pode ver apenas a própria linha (para a aplicação
-- saber se é administrador). Não há política de INSERT/UPDATE/DELETE.
create policy "admin_users: ver a própria linha"
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()));

-- species_groups: leitura pública; escrita apenas por migração.
create policy "species_groups: leitura pública"
  on public.species_groups for select
  to anon, authenticated
  using (true);

-- species
create policy "species: leitura de publicadas ou por administradores"
  on public.species for select
  to anon, authenticated
  using (is_published or (select public.is_admin()));

create policy "species: inclusão por administradores"
  on public.species for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "species: alteração por administradores"
  on public.species for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "species: exclusão por administradores"
  on public.species for delete
  to authenticated
  using ((select public.is_admin()));

-- species_images
create policy "species_images: leitura de espécies publicadas ou por administradores"
  on public.species_images for select
  to anon, authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.species s
      where s.id = species_images.species_id and s.is_published
    )
  );

create policy "species_images: inclusão por administradores"
  on public.species_images for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "species_images: alteração por administradores"
  on public.species_images for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "species_images: exclusão por administradores"
  on public.species_images for delete
  to authenticated
  using ((select public.is_admin()));

-- species_sources (exibidas em "Fontes e referências" das espécies publicadas)
create policy "species_sources: leitura de espécies publicadas ou por administradores"
  on public.species_sources for select
  to anon, authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.species s
      where s.id = species_sources.species_id and s.is_published
    )
  );

create policy "species_sources: inclusão por administradores"
  on public.species_sources for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "species_sources: alteração por administradores"
  on public.species_sources for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "species_sources: exclusão por administradores"
  on public.species_sources for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Privilégios (defesa em profundidade, além da RLS)
-- ---------------------------------------------------------------------------
-- Visitantes anônimos nunca escrevem.
revoke insert, update, delete, truncate on
  public.admin_users, public.species_groups, public.species,
  public.species_images, public.species_sources
from anon;

-- Ninguém altera admin_users ou species_groups pela API.
revoke insert, update, delete, truncate on public.admin_users, public.species_groups
from authenticated;

-- TRUNCATE ignora a RLS; não deve estar disponível pela API.
revoke truncate on public.species, public.species_images, public.species_sources
from authenticated;

-- Funções que alteram dados ou só fazem sentido para administradores.
revoke all on function public.set_species_cover(uuid) from public, anon;
grant execute on function public.set_species_cover(uuid) to authenticated;

revoke all on function public.species_publication_issues(uuid) from public, anon;
grant execute on function public.species_publication_issues(uuid) to authenticated;

-- Chamada pelos gatilhos com o papel de quem altera os dados (authenticated);
-- apenas gera erro quando uma espécie publicada ficaria inválida.
revoke all on function public.assert_species_publishable(uuid) from public, anon;
grant execute on function public.assert_species_publishable(uuid) to authenticated;
