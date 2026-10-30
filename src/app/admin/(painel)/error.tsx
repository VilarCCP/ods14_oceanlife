'use client';

import Link from 'next/link';

/** Falha inesperada no painel (rede, banco, provedor de login). Sem detalhes internos. */
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel" role="alert">
      <h1>Não foi possível carregar esta página do painel</h1>
      <p>
        Pode ser uma falha de conexão com o banco ou com o serviço de login. Verifique sua conexão e
        tente novamente.
      </p>
      <div className="form-actions">
        <button className="button" type="button" onClick={() => reset()}>
          Tentar novamente
        </button>
        <Link className="button button--quiet" href="/admin/login">
          Entrar novamente
        </Link>
      </div>
    </div>
  );
}
