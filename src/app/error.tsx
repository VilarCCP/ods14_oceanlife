'use client';

import Link from 'next/link';

/**
 * Erro inesperado ao carregar uma página. A mensagem não expõe detalhes
 * internos (doc 02 §13) e oferece tentar de novo.
 */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page-width section prose" role="alert">
      <h1>Não foi possível carregar esta página</h1>
      <p>Houve uma falha ao buscar as informações. Verifique sua conexão e tente novamente.</p>
      <p className="follow-up">
        <button type="button" className="button" onClick={() => reset()}>
          Tentar novamente
        </button>
      </p>
      <p>
        <Link href="/">Voltar para o início</Link>
      </p>
    </div>
  );
}
