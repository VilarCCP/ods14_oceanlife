-- OceanLife — seed de desenvolvimento.
--
-- ATENÇÃO: roda apenas no Supabase local / CI (supabase db reset).
-- `supabase db push` NÃO executa este arquivo; ele nunca vai para produção.
--
-- Contém somente registros OBVIAMENTE FICTÍCIOS, sem nenhuma afirmação
-- científica. Espécies reais entram apenas pelo painel administrativo.

insert into public.species (slug, common_name, scientific_name, display_group, short_description)
values
  (
    'especie-de-teste-a',
    'Espécie de teste A',
    'Fictitia exemplaris',
    'outros',
    'Registro fictício usado apenas em desenvolvimento.'
  ),
  (
    'especie-de-teste-b',
    'Espécie de teste B',
    'Fictitia secunda',
    'outros',
    null
  )
on conflict (slug) do nothing;
