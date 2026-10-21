/** Item atual da navegação: a própria rota ou qualquer subpágina dela (ex.: /especies/x). */
export function isCurrentPath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Monta a URL do catálogo preservando pesquisa, grupo e página. Parâmetros
 * vazios ou a página 1 não entram na URL, para que ela fique curta e estável.
 */
export function catalogHref(params: { q?: string; grupo?: string; pagina?: number }): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.grupo) search.set('grupo', params.grupo);
  if (params.pagina && params.pagina > 1) search.set('pagina', String(params.pagina));
  const query = search.toString();
  return query ? `/especies?${query}` : '/especies';
}
