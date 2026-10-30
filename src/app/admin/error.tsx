'use client';

import Link from 'next/link';

/**
 * Falha ao montar o painel (por exemplo, a verificação de acesso não conseguiu
 * falar com o banco). Fica fora do grupo (painel) porque o error.tsx de um
 * segmento não captura erros do layout desse mesmo segmento.
 */
export default function AdminRootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="admin-auth" id="conteudo">
      <div className="admin-auth__card" role="alert">
        <p className="admin-auth__brand">Painel do OceanLife</p>
        <h1>Não foi possível carregar esta página do painel</h1>
        <p>
          Pode ser uma falha de conexão com o banco ou com o serviço de login. Verifique sua conexão
          e tente novamente.
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
    </main>
  );
}
