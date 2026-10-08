import { displayEventName, formatEventDate } from './event-utils';

// Pure helpers building the French meta descriptions (kept free of DB imports so they are testable).

/** Collapses whitespace and cuts at `max` characters (on a word boundary) with an ellipsis. */
export function truncateDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

export function fighterMetadataDescription(
  fighter: { name: string; weight_class?: string | null; record?: string | null; organization_abbreviation?: string | null },
  rating?: { display_score: string | number; weight_class?: string | null } | null,
): string {
  const parts: string[] = [];
  const context = [fighter.organization_abbreviation, fighter.weight_class].filter(Boolean).join(', ');
  parts.push(context ? `${fighter.name} (${context}).` : `${fighter.name}.`);
  if (fighter.record) parts.push(`Bilan : ${fighter.record}.`);
  if (rating && Number.isFinite(Number(rating.display_score))) {
    parts.push(`FightScore : ${Number(rating.display_score).toFixed(1)}/100.`);
  }
  parts.push('Historique des combats, statistiques et classements sur MMA Universe.');
  return truncateDescription(parts.join(' '), 200);
}

export function eventMetadataDescription(
  event: { name: string; date: string; event_location?: string | null; organization_abbreviation?: string | null },
  mainEvent?: { fighter1?: { name: string | null } | null; fighter2?: { name: string | null } | null } | null,
): string {
  const parts: string[] = [];
  const name = displayEventName(event.name);
  const date = formatEventDate(event.date);
  parts.push([name, date, event.event_location].filter(Boolean).join(' · ') + '.');
  const f1 = mainEvent?.fighter1?.name;
  const f2 = mainEvent?.fighter2?.name;
  if (f1 && f2) parts.push(`Main event : ${f1} vs ${f2}.`);
  parts.push('Card complète, résultats et pronostics.');
  return truncateDescription(parts.join(' '), 200);
}

export function organizationMetadataDescription(organization: { name: string; abbreviation?: string | null }): string {
  const label = organization.abbreviation && organization.abbreviation !== organization.name
    ? `${organization.name} (${organization.abbreviation})`
    : organization.name;
  return `${label} : prochains événements, résultats, classements officiels et combattants du roster.`;
}
