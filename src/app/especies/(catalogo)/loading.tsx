// Fica no grupo (catalogo) para valer só para /especies: na página da espécie,
// um carregamento em streaming impediria a resposta 404 de rascunhos e slugs inválidos.
/** Estado de carregamento do catálogo: mesma grade, sem saltos de layout (doc 02 §5.3). */
export default function CatalogLoading() {
  return (
    <div className="page-width section" aria-busy="true">
      <div className="section-intro">
        <h1>Espécies</h1>
        <p role="status">Carregando espécies…</p>
      </div>
      <ul className="species-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index}>
            <div className="skeleton skeleton--window" />
            <div className="skeleton skeleton--line" />
          </li>
        ))}
      </ul>
    </div>
  );
}
