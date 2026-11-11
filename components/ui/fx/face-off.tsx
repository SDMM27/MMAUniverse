import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { OctBadge, initials } from './octagon';

// Weigh-in style face-off: two corners sliding in, a "VS" landing like a
// punch, mirrored bars per measure and the win-probability bar. Purely
// presentational (CSS animations only); every number comes from the caller.
export type FaceOffCorner = {
  name: string;
  href?: string;
  subtitle: string;
  /** Fighter photo; without one the corner shows the initials badge. */
  imageUrl?: string | null;
};

// `portrait`: true as soon as either corner has a photo, so both corners keep
// the same frame (a missing photo then shows the silhouette placeholder).
function CornerPortrait({ corner, align, portrait }: { corner: FaceOffCorner; align: 'left' | 'right'; portrait: boolean }) {
  if (!portrait) {
    return (
      <OctBadge tone={align === 'left' ? 'accent' : 'accent-2'} size={72}>
        {initials(corner.name)}
      </OctBadge>
    );
  }
  // Portrait box close to the source 2:3 ratio, so objectPosition 'top' keeps
  // the face; the corner colour runs along the bottom edge.
  return (
    <CoverImage
      src={corner.imageUrl}
      alt={corner.name}
      sizes="(max-width: 640px) 112px, 176px"
      objectPosition="top"
      className={`h-36 w-28 border-b-4 sm:h-[13rem] sm:w-44 ${align === 'left' ? 'border-accent' : 'border-accent-2'}`}
    />
  );
}

export type FaceOffMeasure = {
  label: string;
  // Displayed values ("185 cm") and the raw numbers sizing the bars.
  a: string;
  b: string;
  rawA: number | null;
  rawB: number | null;
};

function CornerName({ corner, align, portrait }: { corner: FaceOffCorner; align: 'left' | 'right'; portrait: boolean }) {
  const name = (
    <strong className="block font-display text-[clamp(1.5rem,3.4vw,2.5rem)] uppercase leading-[0.9] [overflow-wrap:anywhere]">
      {corner.name}
    </strong>
  );
  return (
    // relative z-[2] + pointer-events-none: above the card-wide link (see
    // FaceOff) without hiding it; only this corner's own links catch clicks.
    <div className={`pointer-events-none relative z-[2] flex min-w-0 flex-col gap-2 ${align === 'left' ? 'fx-in-left items-start' : 'fx-in-right items-end text-right'}`}>
      {corner.href ? (
        <Link href={corner.href} tabIndex={-1} aria-hidden="true" className="pointer-events-auto block">
          <CornerPortrait corner={corner} align={align} portrait={portrait} />
        </Link>
      ) : (
        <CornerPortrait corner={corner} align={align} portrait={portrait} />
      )}
      {corner.href ? (
        <Link href={corner.href} className="pointer-events-auto min-w-0 hover:text-accent-strong">
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
    <div>
      <p className="flex items-baseline justify-between gap-3 font-mono text-xs font-bold tabular-nums">
        <span>{measure.a}</span>
        <span className="uppercase text-muted">{measure.label}</span>
        <span>{measure.b}</span>
      </p>
      <div className="mt-1 grid grid-cols-2 gap-1" aria-hidden="true">
        <div className="flex h-3 justify-end bg-surface-2">
          <span className="fx-bar-r block h-full bg-accent" style={{ width: `${width(measure.rawA)}%`, ...delay }} />
        </div>
        <div className="h-3 bg-surface-2">
          <span className="fx-bar block h-full bg-accent-2" style={{ width: `${width(measure.rawB)}%`, ...delay }} />
        </div>
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
  link,
}: {
  a: FaceOffCorner;
  b: FaceOffCorner;
  pctA: number;
  measures?: FaceOffMeasure[];
  /** Makes the whole card a link (e.g. to the event). Links inside the
   *  footer must carry `relative z-[2]` to stay clickable above it. */
  footer?: React.ReactNode;
  link?: { href: string; label: string };
}) {
  const pctB = 100 - pctA;
  const portrait = Boolean(a.imageUrl || b.imageUrl);
  return (
    <div className={`fx-notch relative grid gap-4 border border-line bg-surface p-4 sm:p-7 ${link ? 'transition-colors hover:border-accent' : ''}`}>
      {link && (
        <Link
          href={link.href}
          aria-label={link.label}
          className="absolute inset-0 z-[1] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-accent"
        />
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-4">
        <CornerName corner={a} align="left" portrait={portrait} />
        <span aria-hidden="true" className="fx-punch font-display text-[clamp(2.75rem,7vw,5.5rem)] text-accent" style={{ animationDelay: '0.5s' }}>
          VS
        </span>
        <CornerName corner={b} align="right" portrait={portrait} />
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
