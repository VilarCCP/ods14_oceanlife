import type { Metadata } from 'next';
import Link from 'next/link';

import { Notice } from '@/components/layout/Notice';

export const metadata: Metadata = {
  title: 'Conservação',
  description: 'Temas de conservação marinha abordados pelo OceanLife.',
};

/**
 * Estrutura da página de conservação (doc 02 §8). Os textos e as referências
 * ainda serão fornecidos pela equipe: nenhuma afirmação sobre o oceano é
 * escrita aqui sem fonte (docs/decisoes.md).
 */
const TOPICS = [
  'Por que os oceanos são importantes',
  'Poluição por plástico e resíduos',
  'Impactos das atividades humanas',
  'Perda de habitat e de biodiversidade',
  'Sobrepesca e outras pressões',
  'Biodiversidade e equilíbrio dos ecossistemas',
  'Atitudes práticas para reduzir impactos',
  'Relação com a ODS 14 — Vida na Água',
];

export default function ConservationPage() {
  return (
    <div className="page-width section">
      <div className="section-intro">
        <h1>Conservação marinha</h1>
        <p>
          Esta página reúne os temas de conservação do oceano tratados pelo OceanLife: os problemas
          que afetam a vida marinha e o que podemos fazer para reduzi-los.
        </p>
      </div>

      <Notice title="Conteúdo em preparação" variant="pending">
        <p>
          Os textos desta página estão sendo escritos e revisados com fontes confiáveis. Cada tema
          será publicado com suas referências, organização responsável e data de consulta.
        </p>
      </Notice>

      <section className="section" aria-labelledby="titulo-temas">
        <h2 id="titulo-temas">Temas</h2>
        <ul className="topic-list">
          {TOPICS.map((topic) => (
            <li key={topic}>
              <h3>{topic}</h3>
              <p>Conteúdo em preparação.</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-referencias-conservacao">
        <h2 id="titulo-referencias-conservacao">Referências</h2>
        <p>As referências serão listadas aqui junto com cada texto publicado.</p>
        <p>
          Enquanto isso, <Link href="/especies">explore as espécies</Link>.
        </p>
      </section>
    </div>
  );
}
