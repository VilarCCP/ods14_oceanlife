-- OceanLife — tabelas principais do catálogo.
-- Referências: docs/01-arquitetura-tecnica.md §6 e docs/decisoes.md
-- (D1, D8, D9, mudanças aprovadas 1, 2, 3 e 9).

-- ---------------------------------------------------------------------------
-- Administradores (decisão D1)
-- ---------------------------------------------------------------------------
-- Ser usuário autenticado NÃO dá acesso administrativo. Só quem está nesta
-- tabela é administrador. Inclusões são feitas por SQL/migração, nunca pela
-- aplicação (não há política de escrita para esta tabela).
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Usuários com acesso ao painel. Alterada apenas por SQL/migração (sem política de escrita).';

-- ---------------------------------------------------------------------------
-- Grupos educativos (decisão D8)
-- ---------------------------------------------------------------------------
-- Lista fechada usada no filtro do catálogo. Não é classificação científica.
create table public.species_groups (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label text not null check (btrim(label) <> ''),
  sort_order integer not null default 0
);

comment on table public.species_groups is
  'Grupos educativos do catálogo (decisão D8). Não substituem a taxonomia científica.';

insert into public.species_groups (slug, label, sort_order) values
  ('peixes', 'Peixes', 10),
  ('mamiferos-marinhos', 'Mamíferos marinhos', 20),
  ('repteis', 'Répteis', 30),
  ('crustaceos', 'Crustáceos', 40),
  ('moluscos', 'Moluscos', 50),
  ('cnidarios', 'Cnidários', 60),
  ('outros', 'Outros', 100);

-- ---------------------------------------------------------------------------
-- Espécies
-- ---------------------------------------------------------------------------
create table public.species (
  id uuid primary key default gen_random_uuid(),
  slug text not null,

  common_name text not null,
  scientific_name text not null,
  -- Usado para detectar duplicidade e para pesquisa (mudança aprovada 9, D7).
  scientific_name_normalized text generated always as (public.normalize_text(scientific_name)) stored,
  search_text text generated always as (
    public.normalize_text(common_name) || ' ' || public.normalize_text(scientific_name)
  ) stored,

  -- Grupo educativo (lista fechada) e classificação científica livre/importada.
  display_group text references public.species_groups (slug) on update cascade on delete set null,
  taxonomic_group text,

  -- Conteúdo educativo. Todos opcionais: ausência de dado é permitida e
  -- nunca deve ser preenchida com suposições.
  short_description text,
  description text,
  habitat text,
  geographic_distribution text,
  diet text,
  physical_characteristics text,
  behavior text,
  life_expectancy text,
  main_threats text,
  ecosystem_importance text,
  curiosities text,

  -- Conservação estruturada (decisão D9).
  conservation_category text,
  conservation_system text,
  conservation_assessment_year smallint,
  conservation_source_url text,
  conservation_accessed_at date,
  -- Texto explicativo opcional sobre o risco (antigo extinction_risk).
  extinction_risk text,

  -- Identificadores externos para evitar duplicidade (mudança aprovada 9).
  worms_aphia_id integer,
  gbif_usage_key bigint,

  is_featured boolean not null default false,
  is_published boolean not null default false,
  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint species_slug_key unique (slug),
  constraint species_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120
  ),
  constraint species_common_name_not_blank check (btrim(common_name) <> ''),
  constraint species_scientific_name_not_blank check (btrim(scientific_name) <> ''),

  constraint species_worms_aphia_id_key unique (worms_aphia_id),
  constraint species_worms_aphia_id_positive check (worms_aphia_id > 0),
  constraint species_gbif_usage_key_key unique (gbif_usage_key),
  constraint species_gbif_usage_key_positive check (gbif_usage_key > 0),

  -- Categorias usadas pela Lista Vermelha da IUCN e por listas nacionais
  -- que seguem o mesmo critério (RE = regionalmente extinta).
  constraint species_conservation_category_valid check (
    conservation_category in ('EX', 'EW', 'RE', 'CR', 'EN', 'VU', 'NT', 'LC', 'DD', 'NE')
  ),
  -- Uma categoria nunca existe sem sistema de avaliação e fonte (D9, doc 01 §7.5).
  constraint species_conservation_requires_source check (
    conservation_category is null
    or (
      conservation_system is not null and btrim(conservation_system) <> ''
      and conservation_source_url is not null
      and conservation_accessed_at is not null
    )
  ),
  constraint species_conservation_year_range check (
    conservation_assessment_year between 1900 and 2100
  ),
  constraint species_conservation_source_url_http check (
    conservation_source_url ~* '^https?://'
  )
);

comment on table public.species is 'Catálogo de espécies. Visitantes veem apenas registros publicados.';
comment on column public.species.scientific_name_normalized is
  'Nome científico sem acentos, em minúsculas e com espaços simples. Usado para avisar sobre duplicidade.';
comment on column public.species.search_text is
  'Nome popular + nome científico normalizados, para pesquisa sem acentos (D7).';
comment on column public.species.extinction_risk is
  'Texto explicativo opcional. A categoria oficial fica em conservation_category (D9).';

create index species_published_idx on public.species (is_published, common_name);
create index species_scientific_name_normalized_idx on public.species (scientific_name_normalized);
create index species_display_group_idx on public.species (display_group) where is_published;

create trigger species_set_updated_at
  before update on public.species
  for each row execute function public.set_updated_at();

-- Mantém published_at coerente com is_published.
create or replace function public.species_set_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) then
    new.published_at := now();
  elsif not new.is_published then
    new.published_at := null;
  end if;
  return new;
end;
$$;

create trigger species_set_published_at
  before insert or update of is_published on public.species
  for each row execute function public.species_set_published_at();

-- ---------------------------------------------------------------------------
-- Imagens das espécies (doc 01 §6.2 + mudança aprovada 1)
-- ---------------------------------------------------------------------------
create table public.species_images (
  id uuid primary key default gen_random_uuid(),
  species_id uuid not null references public.species (id) on delete cascade,
  -- Caminho no bucket species-images: species/{species_id}/{uuid}.{ext} (D4).
  storage_path text not null,
  alt_text text,
  caption text,
  credit text,
  license text,
  source_url text,
  is_cover boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint species_images_storage_path_key unique (storage_path),
  constraint species_images_storage_path_format check (
    storage_path ~ ('^species/' || species_id::text || '/[0-9a-f-]{36}\.(webp|jpg|jpeg|png)$')
  ),
  constraint species_images_alt_text_not_blank check (btrim(alt_text) <> ''),
  constraint species_images_display_order_non_negative check (display_order >= 0),
  constraint species_images_source_url_http check (source_url ~* '^https?://'),
  -- No máximo uma capa por espécie. DEFERRABLE para que a troca de capa num
  -- único comando (ver set_species_cover) seja verificada ao fim do comando.
  constraint species_images_one_cover exclude using btree (species_id with =)
    where (is_cover) deferrable initially immediate
);

comment on table public.species_images is
  'Imagens das espécies. Arquivos ficam no Storage (bucket species-images); aqui só caminho e metadados.';

create index species_images_species_order_idx on public.species_images (species_id, display_order);

-- ---------------------------------------------------------------------------
-- Fontes dos dados (doc 01 §6.3)
-- ---------------------------------------------------------------------------
create table public.species_sources (
  id uuid primary key default gen_random_uuid(),
  species_id uuid not null references public.species (id) on delete cascade,
  provider text not null,
  reference_title text,
  source_url text,
  source_record_id text,
  -- Campos da espécie que vieram desta fonte, ex.: ["scientific_name", "taxonomic_group"].
  fields_imported jsonb not null default '[]'::jsonb,
  accessed_at date not null,
  license_or_attribution text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint species_sources_provider_valid check (provider in ('worms', 'gbif', 'manual')),
  constraint species_sources_fields_is_array check (jsonb_typeof(fields_imported) = 'array'),
  constraint species_sources_source_url_http check (source_url ~* '^https?://'),
  -- Fonte manual precisa ser identificável: título ou URL.
  constraint species_sources_manual_identifiable check (
    provider <> 'manual'
    or (coalesce(btrim(reference_title), '') <> '' or source_url is not null)
  )
);

comment on table public.species_sources is
  'Fontes consultadas para cada espécie (importações e referências manuais).';

create index species_sources_species_idx on public.species_sources (species_id);

create trigger species_sources_set_updated_at
  before update on public.species_sources
  for each row execute function public.set_updated_at();
