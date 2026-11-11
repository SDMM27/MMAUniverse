import Link from 'next/link';
import { SimulatorFighter } from '@/data/lib/definitions';
import { fighterHref } from '@/data/lib/slug';
import { buildSimulatorPath } from '@/data/lib/simulator-params';
import FaceOff, { type FaceOffCorner, type FaceOffMeasure } from '@/components/ui/fx/face-off';
import { matchupOdds } from './matchup-odds';

// Physical measures shown as mirrored bars (only when both are known).
export function tapeMeasures(a: SimulatorFighter, b: SimulatorFighter): FaceOffMeasure[] {
  const measures: FaceOffMeasure[] = [];
  if (a.height_cm && b.height_cm) {
    measures.push({ label: 'Taille', a: `${a.height_cm} cm`, b: `${b.height_cm} cm`, rawA: a.height_cm, rawB: b.height_cm });
  }
  if (a.reach_cm && b.reach_cm) {
    measures.push({ label: 'Allonge', a: `${a.reach_cm} cm`, b: `${b.reach_cm} cm`, rawA: a.reach_cm, rawB: b.reach_cm });
  }
  return measures;
}

export function cornerSubtitle(fighter: SimulatorFighter) {
  return [fighter.weight_class, fighter.record, fighter.is_champion ? 'Champion' : null].filter(Boolean).join(' · ');
}

// One corner of the face-off: name, profile link, record line and photo.
export function faceOffCorner(fighter: SimulatorFighter): FaceOffCorner {
  return {
    name: fighter.fighter_name,
    href: fighterHref({ id: fighter.fighter_id, name: fighter.fighter_name }),
    subtitle: cornerSubtitle(fighter),
    imageUrl: fighter.fighter_image_url,
  };
}

// The weigh-in face-off for a real matchup, with the simulator's own win
// probability (same computation as /simulateur, see matchup-odds.ts).
export default function MatchupFaceOff({
  a,
  b,
  link,
}: {
  a: SimulatorFighter;
  b: SimulatorFighter;
  /** Whole-card link, e.g. to the event on the home page. */
  link?: { href: string; label: string };
}) {
  const { pctA } = matchupOdds(a, b);
  return (
    <FaceOff
      a={faceOffCorner(a)}
      b={faceOffCorner(b)}
      pctA={pctA}
      measures={tapeMeasures(a, b)}
      link={link}
      footer={
        <p className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs uppercase text-muted">
          <span>Probabilité de victoire estimée par le simulateur</span>
          <Link href={buildSimulatorPath({ a: a.fighter_id, b: b.fighter_id })} className="relative z-[2] inline-flex min-h-11 items-center font-bold text-accent-strong hover:underline">
            Méthode et round probables →
          </Link>
        </p>
      }
    />
  );
}
