// Shared by the /analyses server page and its client charts.

export const METHOD_COLORS = { ko: 'var(--sd-accent)', sub: 'var(--sd-accent-2)', dec: 'var(--sd-muted)' } as const;
export const METHOD_LABELS = { ko: 'KO/TKO', sub: 'Soumission', dec: 'Décision' } as const;
export const SINGLE_SERIES_COLOR = 'var(--sd-accent)';

const percentFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const roundPercentFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const integerFormat = new Intl.NumberFormat('fr-FR');

/** 0.4567 -> "45,7 %" */
export function formatPercent(ratio: number, digits: 0 | 1 = 1): string {
  return `${(digits === 0 ? roundPercentFormat : percentFormat).format(ratio * 100)} %`;
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatInteger(value: number): string {
  return integerFormat.format(value);
}
