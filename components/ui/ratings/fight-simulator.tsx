'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import { SimulatorFighter } from '@/data/lib/definitions';
import { predictFight } from '@/data/lib/rating/simulate-fight';

const isWomen = (fighter: SimulatorFighter) => fighter.weight_class.startsWith("Women's");

const CONFIDENCE_LABEL = {
  high: 'Fiabilité élevée : les deux combattants ont un historique récent et solide.',
  medium: 'Fiabilité moyenne : au moins un des deux a peu combattu récemment ou peu de combats UFC.',
  low: 'Fiabilité faible : au moins un des deux est très incertain (peu de combats ou longue inactivité).',
} as const;

function FighterPicker({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: SimulatorFighter[];
  selected: SimulatorFighter | null;
  onSelect: (fighter: SimulatorFighter | null) => void;
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return options.filter((f) => f.fighter_name.toLowerCase().includes(needle)).slice(0, 8);
  }, [query, options]);

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-base-border bg-base-card p-4">
        <CoverImage src={selected.fighter_image_url} alt={selected.fighter_name} className="h-16 w-16 shrink-0 rounded-full" sizes="64px" objectPosition="top" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs uppercase tracking-widest text-ink-secondary">{label}</p>
          <Link href={`/fighters/${selected.fighter_id}`} className="flex items-center gap-2 truncate text-lg text-ink-primary hover:text-accent">
            <CountryFlag code={selected.fighter_nationality} className="shrink-0 text-sm" />
            <span className="truncate">{selected.fighter_name}</span>
          </Link>
          <p className="truncate text-xs text-ink-secondary">
            {selected.weight_class}
            {selected.is_champion && ' · Champion'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery('');
          }}
          className="shrink-0 text-xs uppercase tracking-wide text-accent hover:underline"
        >
          Changer
        </button>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-base-border bg-base-card p-4">
      <label className="font-display text-xs uppercase tracking-widest text-ink-secondary" htmlFor={`sim-${label}`}>
        {label}
      </label>
      <input
        id={`sim-${label}`}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher un combattant..."
        autoComplete="off"
        className="mt-2 w-full rounded-lg border border-base-border bg-transparent px-3 py-2 text-sm text-ink-primary placeholder:text-ink-secondary focus:border-accent focus:outline-none"
      />
      {matches.length > 0 && (
        <ul className="absolute inset-x-4 top-full z-10 mt-1 overflow-hidden rounded-lg border border-base-border bg-base-card shadow-lg">
          {matches.map((fighter) => (
            <li key={fighter.fighter_id}>
              <button
                type="button"
                onClick={() => onSelect(fighter)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.05]"
              >
                <CoverImage src={fighter.fighter_image_url} alt="" className="h-8 w-8 shrink-0 rounded-full" sizes="32px" objectPosition="top" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink-primary">{fighter.fighter_name}</span>
                <span className="shrink-0 text-xs text-ink-secondary">{fighter.weight_class}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && matches.length === 0 && <p className="mt-2 text-xs text-ink-secondary">Aucun combattant classé ne correspond.</p>}
    </div>
  );
}

export default function FightSimulator({ fighters }: { fighters: SimulatorFighter[] }) {
  const [a, setA] = useState<SimulatorFighter | null>(null);
  const [b, setB] = useState<SimulatorFighter | null>(null);

  // Men and women's ratings are computed on separate pools that never fight
  // each other, so a mixed matchup would compare numbers that mean nothing
  // together -- once one corner is picked, the other is offered only same-gender.
  const optionsFor = (other: SimulatorFighter | null) =>
    fighters.filter((f) => (!other || isWomen(f) === isWomen(other)) && f.fighter_id !== other?.fighter_id);

  const prediction = a && b ? predictFight({ rating: a.rating, rd: a.rd }, { rating: b.rating, rd: b.rd }) : null;
  const pctA = prediction ? Math.round(prediction.winA * 100) : 0;
  const pctB = prediction ? 100 - pctA : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <FighterPicker label="Coin rouge" options={optionsFor(b)} selected={a} onSelect={setA} />
        <FighterPicker label="Coin bleu" options={optionsFor(a)} selected={b} onSelect={setB} />
      </div>

      {a && b && prediction ? (
        <div className="rounded-xl border border-base-border bg-base-card p-5">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm text-ink-secondary">{a.fighter_name}</p>
              <p className={`font-display text-4xl ${pctA >= pctB ? 'text-accent' : 'text-ink-primary'}`}>{pctA}%</p>
            </div>
            <div className="min-w-0 text-right">
              <p className="truncate text-sm text-ink-secondary">{b.fighter_name}</p>
              <p className={`font-display text-4xl ${pctB > pctA ? 'text-accent' : 'text-ink-primary'}`}>{pctB}%</p>
            </div>
          </div>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${a.fighter_name} ${pctA}%, ${b.fighter_name} ${pctB}%`}>
            <div className="bg-accent" style={{ width: `${pctA}%` }} />
            <div className="bg-ink-secondary/60" style={{ width: `${pctB}%` }} />
          </div>
          <p className="mt-4 text-sm text-ink-secondary">{CONFIDENCE_LABEL[prediction.confidence]}</p>
          {a.weight_class !== b.weight_class && (
            <p className="mt-1 text-xs text-ink-secondary">
              Combattants de catégories différentes ({a.weight_class} / {b.weight_class}) : le FightScore est un seul niveau par
              combattant, mais la différence de poids réelle n&apos;est pas modélisée.
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-base-border p-6 text-center text-sm text-ink-secondary">
          Choisis deux combattants pour simuler leur affrontement.
        </p>
      )}
    </div>
  );
}
