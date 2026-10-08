'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import { SimulatorFighter } from '@/data/lib/definitions';
import { predictFight } from '@/data/lib/rating/simulate-fight';
import { FINISH_METHODS, contextMix, predictOutcomes, type FinishMethod } from '@/data/lib/rating/fight-outcome';
import { FIGHT_OUTCOME_MODEL } from '@/data/lib/rating/fight-outcome-model';
import { predictMatchup, profileRates, type MatchupFactor, type MatchupPrediction } from '@/data/lib/rating/matchup-model';
import { MATCHUP_MODEL } from '@/data/lib/rating/matchup-model-tuned';

const isWomen = (fighter: SimulatorFighter) => fighter.weight_class.startsWith("Women's");

const METHOD_LABEL: Record<FinishMethod, string> = { ko: 'KO / TKO', sub: 'Soumission', dec: 'Décision' };
const METHOD_PHRASE: Record<FinishMethod, string> = { ko: 'par KO / TKO', sub: 'par soumission', dec: 'par décision' };

const formatPct = (p: number) => (p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`);

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
            {selected.matchup_profile.age != null && ` · ${Math.floor(selected.matchup_profile.age)} ans`}
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

// How it ends, given P(A wins): the six (winner, method) outcomes and when the
// finishes come. See data/lib/rating/fight-outcome.ts for the model.
function OutcomeBreakdown({ a, b, winA, rounds }: { a: SimulatorFighter; b: SimulatorFighter; winA: number; rounds: 3 | 5 }) {
  const lines = useMemo(
    () =>
      predictOutcomes(
        winA,
        a.outcome_profile,
        b.outcome_profile,
        contextMix(FIGHT_OUTCOME_MODEL, [a.weight_class, b.weight_class], rounds),
        rounds,
        FIGHT_OUTCOME_MODEL,
      ),
    [a, b, winA, rounds],
  );
  const name = (corner: 'A' | 'B') => (corner === 'A' ? a.fighter_name : b.fighter_name);
  const line = (corner: 'A' | 'B', method: FinishMethod) => lines.find((l) => l.corner === corner && l.method === method)!;

  const top = lines.reduce((best, l) => (l.probability > best.probability ? l : best));
  const topRound = top.byRound.length > 0 ? top.byRound.indexOf(Math.max(...top.byRound)) + 1 : null;

  // When it ends: each round's finishes, then the decision, split by corner.
  const endings = [
    ...Array.from({ length: rounds }, (_, i) => ({
      label: `Round ${i + 1}`,
      a: lines.filter((l) => l.corner === 'A').reduce((s, l) => s + (l.byRound[i] ?? 0), 0),
      b: lines.filter((l) => l.corner === 'B').reduce((s, l) => s + (l.byRound[i] ?? 0), 0),
    })),
    { label: 'Décision', a: line('A', 'dec').probability, b: line('B', 'dec').probability },
  ];
  const widest = Math.max(...endings.map((e) => e.a + e.b));

  return (
    <div className="mt-6 flex flex-col gap-6 border-t border-base-border pt-5">
      <div>
        <p className="font-display text-xs uppercase tracking-widest text-ink-secondary">Scénario le plus probable</p>
        <p className="mt-1 text-lg text-ink-primary">
          {name(top.corner)} {METHOD_PHRASE[top.method]}
          {topRound && <span className="text-ink-secondary">, le plus souvent au round {topRound}</span>}
          <span className="ml-2 font-display text-accent">{formatPct(top.probability)}</span>
        </p>
        <p className="mt-1 text-xs text-ink-secondary">
          Aucun scénario n&apos;est sûr : c&apos;est seulement le plus fréquent parmi les six issues ci-dessous.
        </p>
      </div>

      <div>
        <p className="font-display text-xs uppercase tracking-widest text-ink-secondary">Méthode de victoire</p>
        <table className="mt-2 w-full table-fixed text-sm">
          <thead>
            <tr className="text-xs text-ink-secondary">
              <th className="w-1/3 py-1 text-left font-normal" />
              <th className="truncate py-1 text-right font-normal">{a.fighter_name}</th>
              <th className="truncate py-1 text-right font-normal">{b.fighter_name}</th>
            </tr>
          </thead>
          <tbody>
            {FINISH_METHODS.map((method) => (
              <tr key={method} className="border-t border-base-border/60">
                <td className="py-2 text-ink-secondary">{METHOD_LABEL[method]}</td>
                {(['A', 'B'] as const).map((corner) => {
                  const cell = line(corner, method);
                  return (
                    <td key={corner} className="py-2 pl-2">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-white/10 sm:block">
                          <div className={`ml-auto h-full ${corner === 'A' ? 'bg-accent' : 'bg-ink-secondary/60'}`} style={{ width: `${(cell.probability / top.probability) * 100}%` }} />
                        </div>
                        <span className={`w-10 text-right tabular-nums ${cell === top ? 'text-accent' : 'text-ink-primary'}`}>{formatPct(cell.probability)}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p className="font-display text-xs uppercase tracking-widest text-ink-secondary">Fin du combat</p>
        <ul className="mt-2 flex flex-col gap-2">
          {endings.map((ending) => (
            <li key={ending.label} className="flex items-center gap-3 text-sm">
              <span className="w-20 shrink-0 text-ink-secondary">{ending.label}</span>
              <div
                className="flex h-3 flex-1 overflow-hidden rounded-full bg-white/5"
                role="img"
                aria-label={`${ending.label} : ${a.fighter_name} ${formatPct(ending.a)}, ${b.fighter_name} ${formatPct(ending.b)}`}
              >
                <div className="bg-accent" style={{ width: `${(ending.a / widest) * 100}%` }} />
                <div className="bg-ink-secondary/60" style={{ width: `${(ending.b / widest) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums text-ink-primary">{formatPct(ending.a + ending.b)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-secondary">
          En couleur, la part de {a.fighter_name} ; en gris, celle de {b.fighter_name}. Le round reste difficile à prévoir : il
          s&apos;écarte peu de la moyenne UFC. Les nuls et no contests (environ 2 % des combats) ne sont pas comptés.
        </p>
      </div>
    </div>
  );
}

// What moved the odds away from the FightScore alone, one line per factor
// that weighs at least a point (see data/lib/rating/matchup-model.ts).
const FACTOR_LABEL: Record<MatchupFactor, string> = {
  age: 'Âge',
  strikes: 'Frappes',
  control: 'Contrôle',
  knockdowns: 'Knockdowns subis',
  layoff: 'Inactivité',
  reach: 'Allonge',
};

const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1).replace('.', ',')}`;

function factorDetail(factor: MatchupFactor, favored: SimulatorFighter, other: SimulatorFighter): string {
  const f = favored.matchup_profile;
  const o = other.matchup_profile;
  const rf = profileRates(f, MATCHUP_MODEL.priorMinutes);
  const ro = profileRates(o, MATCHUP_MODEL.priorMinutes);
  switch (factor) {
    case 'age': {
      const years = Math.floor(o.age!) - Math.floor(f.age!);
      return `${favored.fighter_name} a ${years} an${years > 1 ? 's' : ''} de moins (${Math.floor(f.age!)} contre ${Math.floor(o.age!)} ans)`;
    }
    case 'strikes':
      return `${favored.fighter_name} touche plus qu'il n'encaisse : ${signed(rf.strikeDiffPerMin)} frappe nette par minute à l'UFC, contre ${signed(ro.strikeDiffPerMin)}`;
    case 'control':
      return `${favored.fighter_name} contrôle davantage : ${Math.round(rf.controlShare * 100)} % du temps de contrôle dans ses combats, contre ${Math.round(ro.controlShare * 100)} %`;
    case 'knockdowns':
      return `${other.fighter_name} a été envoyé au tapis ${o.knockdownsAbsorbed} fois à l'UFC, ${favored.fighter_name} ${f.knockdownsAbsorbed} fois`;
    case 'layoff':
      return `${other.fighter_name} n'a pas combattu depuis ${Math.round(o.monthsSinceLastFight!)} mois`;
    case 'reach':
      return `${favored.fighter_name} a ${Math.round(f.reachCm! - o.reachCm!)} cm d'allonge en plus`;
  }
}

function FactorsNote({ a, b, prediction }: { a: SimulatorFighter; b: SimulatorFighter; prediction: MatchupPrediction }) {
  const factors = (Object.entries(prediction.shifts) as [MatchupFactor, number][])
    .filter(([, shift]) => Math.abs(shift) >= 0.01)
    .sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
  const unknown = [
    ...[a, b].filter((f) => f.matchup_profile.age == null).map((f) => `l'âge de ${f.fighter_name}`),
    ...[a, b].filter((f) => f.matchup_profile.reachCm == null).map((f) => `l'allonge de ${f.fighter_name}`),
  ];
  const baseA = Math.round(prediction.ratingOnly * 100);

  return (
    <div className="mt-4">
      <p className="font-display text-xs uppercase tracking-widest text-ink-secondary">Ce qui fait pencher la balance</p>
      <p className="mt-1 text-xs text-ink-secondary">
        Sur le FightScore seul : {a.fighter_name} {baseA} %, {b.fighter_name} {100 - baseA} %.
      </p>
      {factors.length === 0 ? (
        <p className="mt-2 text-sm text-ink-secondary">Aucun autre facteur ne pèse vraiment : l&apos;estimation repose sur le FightScore.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {factors.map(([factor, shift]) => {
            const favored = shift > 0 ? a : b;
            return (
              <li key={factor} className="flex items-baseline gap-3 text-sm">
                <span className="w-32 shrink-0 text-ink-secondary">{FACTOR_LABEL[factor]}</span>
                <span className="min-w-0 flex-1 text-ink-primary">{factorDetail(factor, favored, favored === a ? b : a)}</span>
                <span className="shrink-0 tabular-nums text-accent">
                  +{Math.round(Math.abs(shift) * 100)} pt{Math.round(Math.abs(shift) * 100) > 1 ? 's' : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {unknown.length > 0 && <p className="mt-2 text-xs text-ink-secondary">Inconnu : {unknown.join(', ')}. Ce facteur n&apos;est pas pris en compte.</p>}
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

  const rating = a && b ? predictFight({ rating: a.rating, rd: a.rd }, { rating: b.rating, rd: b.rd }) : null;
  const prediction = a && b && rating ? predictMatchup(rating.winA, a.matchup_profile, b.matchup_profile, MATCHUP_MODEL) : null;
  const pctA = prediction ? Math.round(prediction.winA * 100) : 0;
  const pctB = prediction ? 100 - pctA : 0;
  // Title fights are five rounds: default to that when a champion is in the matchup.
  const [roundsChoice, setRoundsChoice] = useState<3 | 5 | null>(null);
  const rounds = roundsChoice ?? (a?.is_champion || b?.is_champion ? 5 : 3);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <FighterPicker label="Coin rouge" options={optionsFor(b)} selected={a} onSelect={setA} />
        <FighterPicker label="Coin bleu" options={optionsFor(a)} selected={b} onSelect={setB} />
      </div>

      {a && b && rating && prediction ? (
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
          <p className="mt-4 text-sm text-ink-secondary">{CONFIDENCE_LABEL[rating.confidence]}</p>
          <FactorsNote a={a} b={b} prediction={prediction} />
          {a.weight_class !== b.weight_class && (
            <p className="mt-1 text-xs text-ink-secondary">
              Combattants de catégories différentes ({a.weight_class} / {b.weight_class}) : le FightScore est un seul niveau par
              combattant, mais la différence de poids réelle n&apos;est pas modélisée.
            </p>
          )}
          <div className="mt-5 flex items-center gap-2 text-xs">
            <span className="text-ink-secondary">Durée prévue</span>
            {([3, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRoundsChoice(n)}
                aria-pressed={rounds === n}
                className={`rounded-full border px-3 py-1 uppercase tracking-wide ${
                  rounds === n ? 'border-accent text-accent' : 'border-base-border text-ink-secondary hover:text-ink-primary'
                }`}
              >
                {n} rounds
              </button>
            ))}
          </div>
          <OutcomeBreakdown a={a} b={b} winA={prediction.winA} rounds={rounds} />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-base-border p-6 text-center text-sm text-ink-secondary">
          Choisis deux combattants pour simuler leur affrontement.
        </p>
      )}
    </div>
  );
}
