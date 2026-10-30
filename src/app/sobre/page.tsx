import type { Metadata } from 'next';
import Link from 'next/link';

import { siteConfig } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Sobre o projeto',
  description: 'O propósito educativo do OceanLife e sua relação com a ODS 14 — Vida na Água.',
};

/**
 * Texto baseado no documento de escopo do projeto (docs/00-escopo.md) e no
 * doc 02 §9. Não afirma parcerias, certificações ou validações científicas.
 */
export default function AboutPage() {
  return (
    <div className="page-width section prose">
      <h1>Sobre o OceanLife</h1>

      <h2>Propósito</h2>
      <p>
        O OceanLife é uma plataforma educativa para explorar a vida marinha. Você pode pesquisar
        espécies pelo nome popular ou científico, ver suas imagens e conhecer suas principais
        características.
      </p>

      <h2>Relação com a {siteConfig.sdg}</h2>
      <p>
        O projeto está relacionado à ODS 14 — Vida na Água e busca contribuir para a conscientização
        sobre a preservação dos oceanos e os impactos da ação humana no ambiente marinho. É uma
        contribuição educativa: o OceanLife não cumpre, por si só, as metas oficiais da ODS 14.
      </p>

      <h2>Para quem é</h2>
      <p>
        O projeto nasceu em ambiente escolar, mas foi pensado para estudantes, professores e
        qualquer pessoa curiosa sobre o oceano, com linguagem acessível e sem exigir conhecimento
        científico avançado.
      </p>

      <h2>Escopo e limitações</h2>
      <p>
        Nesta primeira versão, o catálogo reúne um conjunto inicial de espécies, apresentadas com
        imagens e informações. Vídeos e animações dos animais não fazem parte desta versão. Novas
        espécies poderão ser adicionadas aos poucos.
      </p>
      <p>
        Nem toda espécie tem todas as informações. Quando um dado não está disponível em uma fonte
        confiável, ele aparece como indisponível, em vez de ser preenchido com suposições.
      </p>

      <h2>Fontes das informações</h2>
      <p>
        Cada espécie indica as fontes consultadas e a data da consulta. As informações podem mudar
        conforme as fontes são atualizadas, principalmente as avaliações de conservação. Dados
        taxonômicos podem ser consultados em bases como o WoRMS (World Register of Marine Species) e
        o GBIF (Global Biodiversity Information Facility), sempre com revisão humana antes da
        publicação.
      </p>

      <p className="follow-up">
        <Link className="button" href="/especies">
          Explorar as espécies
        </Link>
      </p>
    </div>
  );
}
