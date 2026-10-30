import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Proxy do painel (antigo "middleware"): renova a sessão do Supabase nos
 * cookies e manda quem não está logado para a tela de login.
 *
 * Isto é só conveniência. A autorização de verdade acontece no servidor, em
 * cada página e ação (src/lib/auth.ts), e na RLS do banco.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { pathname, search } = request.nextUrl;
  let signedIn = false;
  try {
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims);
  } catch {
    // Provedor indisponível: deixa a página decidir e mostrar o erro adequado.
    return response;
  }

  const isPublicAdminPage = pathname === '/admin/login';
  if (!signedIn && !isPublicAdminPage) {
    const login = request.nextUrl.clone();
    login.pathname = '/admin/login';
    login.search = '';
    if (pathname !== '/admin') login.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
