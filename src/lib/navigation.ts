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

/**
 * Destino seguro depois do login: só caminhos internos do painel. Evita
 * redirecionar para outro site (ex.: "//exemplo.com" ou "https://...").
 */
export function safeAdminPath(raw: string | null | undefined): string {
  if (!raw) return '/admin';
  if (!raw.startsWith('/admin')) return '/admin';
  if (raw.startsWith('//') || raw.includes('\\') || /[\r\n]/.test(raw)) return '/admin';
  // A própria tela de login não é um destino útil.
  if (raw === '/admin/login' || raw.startsWith('/admin/login?')) return '/admin';
  // "/administrador" não é o painel.
  if (raw.length > 6 && !['/', '?', '#'].includes(raw[6] ?? '')) return '/admin';
  return raw;
}

/** URL da tela de login que volta para `path` depois de entrar. */
export function loginHref(path: string): string {
  const target = safeAdminPath(path);
  return target === '/admin' ? '/admin/login' : `/admin/login?next=${encodeURIComponent(target)}`;
}
