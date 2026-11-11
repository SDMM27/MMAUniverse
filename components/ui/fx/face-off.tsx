import Link from 'next/link';
import { OctBadge, initials } from './octagon';

// Weigh-in style face-off: two corners sliding in, a "VS" landing like a
// punch, mirrored bars per measure and the win-probability bar. Purely
// presentational (CSS animations only); every number comes from the caller.
export type FaceOffCorner = {
  name: string;
  href?: string;
  subtitle: string;
};

export type FaceOffMeasure = {
  label: string;
  // Displayed values ("185 cm") and the raw numbers sizing the bars.
  a: string;
  b: string;
  rawA: number | null;
  rawB: number | null;
};

function CornerName({ corner, align }: { corner: FaceOffCorner; align: 'left' | 'right' }) {
  const name = (
    <strong className="block font-display text-[clamp(1.5rem,3.4vw,2.5rem)] uppercase leading-[0.9] [overflow-wrap:anywhere]">
      {corner.name}
    </strong>
  );
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${align === 'left' ? 'fx-in-left items-start' : 'fx-in-right items-end text-right'}`}>
      <OctBadge tone={align === 'left' ? 'accent' : 'accent-2'} size={72}>
        {initials(corner.name)}
      </OctBadge>
      {corner.href ? (
        <Link href={corner.href} className="min-w-0 hover:text-accent-strong">
          {name}
        </Link>
      ) : (
        name
      )}
      <span className="font-mono text-xs uppercase text-muted">{corner.subtitle}</span>
    </div>
  );
}

function MirrorBar({ measure, index }: { measure: FaceOffMeasure; index: number }) {
  const max = Math.max(measure.rawA ?? 0, measure.rawB ?? 0);
  // Proportional to the larger of the two values (which fills its half).
  const width = (raw: number | null) => (raw == null || max === 0 ? 0 : (100 * raw) / max);
  const delay = { animationDelay: `${300 + index * 120}ms` };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
      <div className="flex h-3 justify-end bg-surface-2" aria-hidden="true">
        <span className="fx-bar-r block h-full bg-accent" style={{ width: `${width(measure.rawA)}%`, ...delay }} />
      </div>
      <span className="w-[13ch] text-center font-mono text-xs font-bold tabular-nums">
        {measure.a} <span className="text-muted">· {measure.label} ·</span> {measure.b}
      </span>
      <div className="h-3 bg-surface-2" aria-hidden="true">
        <span className="fx-bar block h-full bg-accent-2" style={{ width: `${width(measure.rawB)}%`, ...delay }} />
      </div>
    </div>
  );
}

export default function FaceOff({
  a,
  b,
  pctA,
  measures = [],
  footer,
}: {
  a: FaceOffCorner;
  b: FaceOffCorner;
  pctA: number;
  measures?: FaceOffMeasure[];
  footer?: React.ReactNode;
}) {
  const pctB = 100 - pctA;
  return (
    <div className="fx-notch grid gap-4 border border-line bg-surface p-4 sm:p-7">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-4">
        <CornerName corner={a} align="left" />
        <span aria-hidden="true" className="fx-punch font-display text-[clamp(2.75rem,7vw,5.5rem)] text-accent" style={{ animationDelay: '0.5s' }}>
          VS
        </span>
        <CornerName corner={b} align="right" />
      </div>

      {measures.length > 0 && (
        <div className="flex flex-col gap-2 pt-2">
          {measures.map((measure, i) => (
            <MirrorBar key={measure.label} measure={measure} index={i} />
          ))}
        </div>
      )}

      <div
        role="img"
        aria-label={`Probabilité de victoire : ${a.name} ${pctA} %, ${b.name} ${pctB} %`}
        className="mt-1 flex h-[52px] overflow-hidden font-display text-2xl"
      >
        <span
          className="fx-bar flex min-w-[4.5rem] items-center bg-accent pl-3 text-accent-ink sm:pl-5"
          style={{ width: `${pctA}%`, animationDelay: '0.8s' }}
        >
          {pctA} %
        </span>
        <span className="flex min-w-[4.5rem] flex-1 items-center justify-end bg-accent-2 pr-3 text-[#1a1205] sm:pr-5">{pctB} %</span>
      </div>
      {footer}
    </div>
  );
}
