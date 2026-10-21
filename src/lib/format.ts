/**
 * Formatação para exibição. Rótulos das categorias de conservação seguem a
 * nomenclatura em português usada pela Lista Vermelha da IUCN e pelas listas
 * nacionais brasileiras. São nomes de categorias, não avaliações de espécies.
 */

const CONSERVATION_LABELS: Record<string, string> = {
  EX: 'Extinta',
  EW: 'Extinta na natureza',
  RE: 'Regionalmente extinta',
  CR: 'Criticamente em perigo',
  EN: 'Em perigo',
  VU: 'Vulnerável',
  NT: 'Quase ameaçada',
  LC: 'Menos preocupante',
  DD: 'Dados insuficientes',
  NE: 'Não avaliada',
};

/** "Em perigo (EN)" — ou só o código, se for desconhecido. */
export function conservationLabel(category: string): string {
  const label = CONSERVATION_LABELS[category];
  return label ? `${label} (${category})` : category;
}

/** Data AAAA-MM-DD → "21/10/2026". Não aplica fuso horário (é uma data, não um instante). */
export function formatDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

const PROVIDER_LABELS: Record<string, string> = {
  worms: 'WoRMS — World Register of Marine Species',
  gbif: 'GBIF — Global Biodiversity Information Facility',
  manual: 'Referência',
};

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

/** "1 espécie" / "12 espécies". */
export function speciesCount(total: number): string {
  return total === 1 ? '1 espécie' : `${total} espécies`;
}
