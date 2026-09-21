'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import { groupFighterRatingsByWeightClass, orderDivisionWithChampionPinned, sortWeightClassGroups } from '@/data/lib/rating/order-division';
import { FighterRatingWithFighter } from '@/data/lib/definitions';
import { FighterRankRow, formatScore, ScoreBar, StreakBadge, weightClassSlug } from './fightscore-parts';

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
      href={`/fighters/${champion.fighter_id}`}
      className="group flex items-center gap-4 border-b border-base-border bg-gradient-to-r from-accent/15 to-transparent p-4"
    >
      <CoverImage
        src={champion.fighter_image_url}
        alt={champion.fighter_name}
        className="h-20 w-16 shrink-0 rounded-lg"
        sizes="64px"
        objectPosition="top"
      />
      <div className="min-w-0 flex-1">
        <span className="rounded bg-accent px-2 py-0.5 font-display text-[11px] uppercase tracking-widest text-white">Champion</span>
        <p className="mt-2 flex items-center gap-2 truncate font-display text-xl uppercase text-ink-primary group-hover:text-accent">
          <CountryFlag code={champion.fighter_nationality} className="shrink-0 text-sm" />
          <span className="truncate">{champion.fighter_name}</span>
          {outranked && (
            <sup className="text-accent" title={OUTRANKED_NOTE}>
              *
            </sup>
          )}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-secondary">
          {champion.style_archetype}
          <StreakBadge streak={champion.current_streak} />
        </p>
      </div>
      <div className="w-20 shrink-0 text-right sm:w-28">
        <p className="font-display text-3xl text-ink-primary">{formatScore(champion.display_score)}</p>
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
      <div role="tablist" aria-label="Catégories" className="scrollbar-none -mx-6 mb-4 flex gap-2 overflow-x-auto px-6 pb-1">
        {groups.map((g) => {
          const active = g.weightClass === group.weightClass;
          return (
            <button
              key={g.weightClass}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => select(g.weightClass)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 font-display text-xs uppercase tracking-wide transition-colors ${
                active ? 'border-accent bg-accent text-white' : 'border-base-border text-ink-secondary hover:border-accent hover:text-accent'
              }`}
            >
              {g.weightClass}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="overflow-hidden rounded-xl border border-base-border bg-base-card">
        {champion && <ChampionCard champion={champion} outranked={championOutranked} />}
        {contenders.map((fighter, i) => (
          <FighterRankRow
            key={fighter.id}
            fighter={fighter}
            rankLabel={String(i + 1)}
            highlight={!champion && i === 0}
            subtitle={fighter.style_archetype ?? undefined}
          />
        ))}
      </div>

      {championOutranked && <p className="mt-3 text-xs text-ink-secondary">* {OUTRANKED_NOTE}</p>}
    </div>
  );
}
