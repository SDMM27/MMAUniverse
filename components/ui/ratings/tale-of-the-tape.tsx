import { CountryFlag } from '@/components/ui/shared/country-flag';
import { SimulatorFighter } from '@/data/lib/definitions';
import { formatPhysique } from '@/data/lib/fighter-physique';

const MISSING = '—';

type Row = {
  label: string;
  a: React.ReactNode;
  b: React.ReactNode;
  // Which corner has the edge, only for measures where bigger is an advantage.
  edge?: 'a' | 'b' | null;
};

function edgeFor(a: number | null, b: number | null): 'a' | 'b' | null {
  if (a == null || b == null || a === b) return null;
  return a > b ? 'a' : 'b';
}

function Cell({ children, highlighted, align }: { children: React.ReactNode; highlighted: boolean; align: 'left' | 'right' }) {
  return (
    <span
      className={`min-w-0 break-words text-sm ${align === 'right' ? 'text-right' : 'text-left'} ${
        highlighted ? 'font-semibold text-accent-strong' : 'text-ink'
      }`}
    >
      {children}
    </span>
  );
}

export default function TaleOfTheTape({ a, b }: { a: SimulatorFighter; b: SimulatorFighter }) {
  // Height and reach already show as mirrored bars in the face-off when both
  // are known; they only appear here when one side is missing.
  const rows: Row[] = [
    ...(a.height_cm && b.height_cm
      ? []
      : [
          {
            label: 'Taille',
            a: formatPhysique(a.height_cm, null) ?? MISSING,
            b: formatPhysique(b.height_cm, null) ?? MISSING,
            edge: edgeFor(a.height_cm, b.height_cm),
          },
        ]),
    ...(a.reach_cm && b.reach_cm
      ? []
      : [
          {
            label: 'Allonge',
            a: a.reach_cm ? `${a.reach_cm} cm` : MISSING,
            b: b.reach_cm ? `${b.reach_cm} cm` : MISSING,
            edge: edgeFor(a.reach_cm, b.reach_cm),
          },
        ]),
    { label: 'Âge', a: a.age != null ? `${Math.floor(a.age)} ans` : MISSING, b: b.age != null ? `${Math.floor(b.age)} ans` : MISSING },
    { label: 'Palmarès', a: a.record ?? MISSING, b: b.record ?? MISSING },
    {
      label: 'Nationalité',
      a: a.fighter_nationality ? <CountryFlag code={a.fighter_nationality} /> : MISSING,
      b: b.fighter_nationality ? <CountryFlag code={b.fighter_nationality} /> : MISSING,
    },
    { label: 'Catégorie', a: a.weight_class, b: b.weight_class },
  ];

  return (
    <section className="border border-line bg-surface p-5" aria-label="Comparaison physique">
      <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Tale of the tape</h2>
      <div className="mt-3 divide-y divide-line">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
            <Cell align="left" highlighted={row.edge === 'a'}>
              {row.a}
            </Cell>
            <span className="text-center font-mono text-[11px] uppercase text-muted">{row.label}</span>
            <Cell align="right" highlighted={row.edge === 'b'}>
              {row.b}
            </Cell>
          </div>
        ))}
      </div>
    </section>
  );
}
