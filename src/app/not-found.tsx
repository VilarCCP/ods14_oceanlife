import Link from 'next/link';

/**
 * Página não encontrada. Também é usada para espécies não publicadas, sem
 * revelar que um rascunho existe (doc 02 §7.6).
 */
export default function NotFound() {
  return (
    <div className="page-width section prose">
      <h1>Não encontramos esta página</h1>
      <p>O endereço pode estar incorreto ou a página pode não estar mais disponível.</p>
      <p className="follow-up">
        <Link className="button" href="/especies">
          Ver o catálogo de espécies
        </Link>
      </p>
      <p>
        <Link href="/">Voltar para o início</Link>
      </p>
    </div>
  );
}
