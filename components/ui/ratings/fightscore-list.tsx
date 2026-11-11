'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import { groupFighterRatingsByWeightClass, orderDivisionWithChampionPinned, sortWeightClassGroups } from '@/data/lib/rating/order-division';
import { FighterRatingWithFighter } from '@/data/lib/definitions';
import { FighterRankRow, formatScore, ScoreBar, StreakBadge, TrendBadge, weightClassSlug } from './fightscore-parts';
import { OctBadge } from '@/components/ui/fx/octagon';
import { fighterHref } from '@/data/lib/slug';

// One division at a time behind a row of division tabs, rather than all
// twelve stacked (~180 rows): the selected division lives in the URL hash
// (/classement-calcule#lightweight) so the homepage's division cards can
// deep-link straight to it and the choice survives a reload/share.
//
// Champion is always pinned to the top regardless of display_score (an
// editorial choice, not an artifact of the ranking math -- see the design
// spec's "Position du champion" section) -- shown as its own card, with
// everyone else numbered by their position in the already-champion-pinned
// array (1, 2, 3... starting right after the champion, or from 1 if there's
// no matched champion yet).
const OUTRANKED_NOTE =
  "Porte la ceinture, mais n'a pas le FightScore le plus élevé de la division en ce moment — voir la méthodologie.";

function ChampionCard({ champion, outranked }: { champion: FighterRatingWithFighter; outranked: boolean }) {
  return (
    <Link
      href={fighterHref({ id: champion.fighter_id, name: champion.fighter_name })}
      className="fx-row fx-in-left group flex items-center gap-3 border border-accent bg-accent/10 p-3 sm:gap-4"
    >
      <OctBadge tone="accent" size={44}>
        C
      </OctBadge>
      <CoverImage
        src={champion.fighter_image_url}
        alt={champion.fighter_name}
        className="h-20 w-16 shrink-0"
        sizes="64px"
        objectPosition="top"
      />
      <div className="min-w-0 flex-1">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-accent-strong">Champion</span>
        <p className="mt-1 flex items-center gap-2 font-display text-lg uppercase leading-tight text-ink group-hover:text-accent-strong sm:text-xl">
          <CountryFlag code={champion.fighter_nationality} className="shrink-0 text-sm" />
          <span className="min-w-0 break-words">{champion.fighter_name}</span>
          {outranked && (
            <sup className="text-accent-strong" title={OUTRANKED_NOTE}>
              *
            </sup>
          )}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          {champion.style_archetype}
          <StreakBadge streak={champion.current_streak} />
          <TrendBadge fighter={champion} rank={0} />
        </p>
      </div>
      <div className="w-20 shrink-0 text-right sm:w-28">
        <p className="font-display text-3xl text-ink">{formatScore(champion.display_score)}</p>
        <ScoreBar score={champion.display_score} className="mt-1" />
      </div>
    </Link>
  );
}

export default function FightScoreList({ ratings }: { ratings: FighterRatingWithFighter[] }) {
  const groups = sortWeightClassGroups(groupFighterRatingsByWeightClass(ratings));
  const [selected, setSelected] = useState(groups[0]?.weightClass ?? '');

  // Hash -> tab on load and on back/forward (read after mount: the server
  // render has no access to the hash).
  useEffect(() => {
    const syncFromHash = () => {
      const match = groups.find((g) => weightClassSlug(g.weightClass) === window.location.hash.slice(1));
      if (match) setSelected(match.weightClass);
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
    // groups is rebuilt every render from the same `ratings` prop; the weight-class list is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.map((g) => g.weightClass).join('|')]);

  const select = (weightClass: string) => {
    setSelected(weightClass);
    window.history.replaceState(null, '', `#${weightClassSlug(weightClass)}`);
  };

  const group = groups.find((g) => g.weightClass === selected) ?? groups[0];
  if (!group) return null;

  const { fighters, championOutranked } = orderDivisionWithChampionPinned(group.fighters);
  const champion = fighters.find((f) => f.is_champion) ?? null;
  const contenders = fighters.filter((f) => !f.is_champion);

  return (
    <div>
      <div role="tablist" aria-label="Catégories" className="scrollbar-none -mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
        <div className="flex w-max border-2 border-ink sm:w-auto sm:flex-wrap">
          {groups.map((g) => {
            const active = g.weightClass === group.weightClass;
            return (
              <button
                key={g.weightClass}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => select(g.weightClass)}
                className={`min-h-11 shrink-0 px-4 font-display text-sm uppercase transition-colors ${
                  active ? 'bg-ink text-bg' : 'text-ink hover:bg-surface-2'
                }`}
              >
                {g.weightClass}
              </button>
            );
          })}
        </div>
      </div>

      <h3 className="mb-4 font-display text-[clamp(1.75rem,4vw,2.5rem)] uppercase leading-[0.95] text-ink">{group.weightClass}</h3>

      <div role="tabpanel" className="flex flex-col gap-2">
        {champion && <ChampionCard champion={champion} outranked={championOutranked} />}
        {contenders.map((fighter, i) => (
          <FighterRankRow
            key={fighter.id}
            fighter={fighter}
            rankLabel={String(i + 1)}
            rank={i + 1}
            index={i + 1}
            highlight={!champion && i === 0}
            subtitle={fighter.style_archetype ?? undefined}
          />
        ))}
      </div>

      {championOutranked && <p className="mt-3 text-xs text-muted">* {OUTRANKED_NOTE}</p>}
    </div>
  );
}
