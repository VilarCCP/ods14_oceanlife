'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { loginHref } from '@/lib/navigation';
import type { AppError } from '@/lib/result';

/**
 * Mensagem de erro de uma ação do painel. Para sessão expirada, oferece entrar
 * de novo voltando para a mesma página (doc 03 §4.3).
 */
export function ActionError({ error }: { error: AppError }) {
  const pathname = usePathname();
  return (
    <div className="admin-flash admin-flash--error" role="alert">
      {/* Para bloqueios de publicação, a mensagem já lista cada impedimento. */}
      <p>{error.message}</p>
      {error.code === 'unauthenticated' ? (
        <p>
          <Link href={loginHref(pathname)}>Entrar novamente</Link>. O que você digitou neste
          formulário fica guardado neste navegador.
        </p>
      ) : null}
    </div>
  );
}
