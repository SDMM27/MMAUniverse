'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CoverImage } from '@/components/ui/shared/media';
import { CountryFlag } from '@/components/ui/shared/country-flag';
import FaceOff from '@/components/ui/fx/face-off';
import { matchupOdds } from '@/components/ui/ratings/matchup-odds';
import { faceOffCorner, tapeMeasures } from '@/components/ui/ratings/matchup-face-off';
import TaleOfTheTape from '@/components/ui/ratings/tale-of-the-tape';
import { SimulatorFighter } from '@/data/lib/definitions';
import type { MainEventPrefill } from '@/data/lib/simulator-data';
import { buildSimulatorPath } from '@/data/lib/simulator-params';
import { fighterHref } from '@/data/lib/slug';
import { FINISH_METHODS, contextMix, predictOutcomes, type FinishMethod } from '@/data/lib/rating/fight-outcome';
import { FIGHT_OUTCOME_MODEL } from '@/data/lib/rating/fight-outcome-model';
import { profileRates, type MatchupFactor, type MatchupPrediction } from '@/data/lib/rating/matchup-model';
import { MATCHUP_MODEL } from '@/data/lib/rating/matchup-model-tuned';

const isWomen = (fighter: SimulatorFighter) => fighter.weight_class.startsWith("Women's");

const METHOD_LABEL: Record<FinishMethod, string> = { ko: 'KO / TKO', sub: 'Soumission', dec: 'Décision' };
const METHOD_PHRASE: Record<FinishMethod, string> = { ko: 'par KO / TKO', sub: 'par soumission', dec: 'par décision' };

const formatPct = (p: number) => (p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`);

const Swatch = ({ corner }: { corner: 'A' | 'B' }) => (
  <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 ${corner === 'A' ? 'bg-accent' : 'bg-accent-2'}`} />
);

const CONFIDENCE_LABEL = {
  high: 'Fiabilité élevée : les deux combattants ont un historique récent et solide.',
  medium: 'Fiabilité moyenne : au moins un des deux a peu combattu récemment ou peu de combats UFC.',
  low: 'Fiabilité faible : au moins un des deux est très incertain (peu de combats ou longue inactivité).',
} as const;

function FighterPicker({
  label,
  corner,
  options,
  selected,
  onSelect,
}: {
  label: string;
  corner: 'A' | 'B';
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
      <div className={`fx-notch flex min-w-0 items-center gap-3 border border-l-4 border-line bg-surface p-4 ${corner === "A" ? "border-l-accent" : "border-l-accent-2"}`}>
        <CoverImage src={selected.fighter_image_url} alt={selected.fighter_name} className="h-16 w-16 shrink-0 rounded-full" sizes="64px" objectPosition="top" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            <Swatch corner={corner} />
            {label}
          </p>
          <Link href={fighterHref({ id: selected.fighter_id, name: selected.fighter_name })} className="flex min-h-11 items-center gap-2 truncate text-lg text-ink hover:text-accent-strong">
            <CountryFlag code={selected.fighter_nationality} className="shrink-0 text-sm" />
            <span className="truncate">{selected.fighter_name}</span>
          </Link>
          <p className="truncate text-xs text-muted">
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
          className="inline-flex min-h-11 shrink-0 items-center px-1 font-mono text-xs font-bold uppercase text-accent-strong hover:underline"
        >
          Changer
        </button>
      </div>
    );
  }

  return (
    <div className={`relative border border-l-4 border-line bg-surface p-4 ${corner === "A" ? "border-l-accent" : "border-l-accent-2"}`}>
      <label className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted" htmlFor={`sim-${label}`}>
        <Swatch corner={corner} />
        {label}
      </label>
      <input
        id={`sim-${label}`}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher un combattant..."
        autoComplete="off"
        className="mt-2 min-h-11 w-full border border-line bg-transparent px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
      />
      {matches.length > 0 && (
        <ul className="absolute inset-x-4 top-full z-10 mt-1 overflow-hidden border border-line bg-surface shadow-lg">
          {matches.map((fighter) => (
            <li key={fighter.fighter_id}>
              <button
                type="button"
                onClick={() => onSelect(fighter)}
                className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2"
              >
                <CoverImage src={fighter.fighter_image_url} alt="" className="h-8 w-8 shrink-0 rounded-full" sizes="32px" objectPosition="top" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{fighter.fighter_name}</span>
                <span className="shrink-0 text-xs text-muted">{fighter.weight_class}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && matches.length === 0 && <p className="mt-2 text-xs text-muted">Aucun combattant classé ne correspond.</p>}
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
  const toDecision = line('A', 'dec').probability + line('B', 'dec').probability;
  const cornerTotal = (corner: 'A' | 'B') => lines.filter((l) => l.corner === corner).reduce((s, l) => s + l.probability, 0);
  const methodTotal = (method: FinishMethod) => line('A', method).probability + line('B', method).probability;

  return (
    <div className="mt-6 flex flex-col gap-8 border-t border-line pt-5">
      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Scénario le plus probable</p>
        <p className="mt-1 text-lg text-ink">
          {name(top.corner)} {METHOD_PHRASE[top.method]}
          {topRound && <span className="text-muted">, le plus souvent au round {topRound}</span>}
          <span className="ml-2 font-display text-accent-strong">{formatPct(top.probability)}</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          C&apos;est l&apos;issue la plus fréquente parmi les six possibles (deux vainqueurs × trois méthodes), mais elle
          reste loin d&apos;être sûre.
        </p>
      </div>

      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Comment chacun peut gagner</p>
        <table className="mt-2 w-full table-fixed text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="w-[28%] py-1 text-left font-normal" />
              {(['A', 'B'] as const).map((corner) => (
                <th key={corner} className="py-1 pl-2 text-right font-normal">
                  <span className="flex items-center justify-end gap-1.5">
                    <Swatch corner={corner} />
                    <span className="truncate">{name(corner)}</span>
                  </span>
                </th>
              ))}
              <th className="w-[18%] py-1 pl-2 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {FINISH_METHODS.map((method) => (
              <tr key={method} className="border-t border-line">
                <td className="py-2 text-muted">{METHOD_LABEL[method]}</td>
                {(['A', 'B'] as const).map((corner) => {
                  const cell = line(corner, method);
                  return (
                    <td key={corner} className={`py-2 pl-2 text-right tabular-nums ${cell === top ? 'font-bold text-accent-strong' : 'text-ink'}`}>
                      {formatPct(cell.probability)}
                    </td>
                  );
                })}
                <td className="py-2 pl-2 text-right tabular-nums text-muted">{formatPct(methodTotal(method))}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-line">
              <td className="py-2 text-ink">Victoire</td>
              {(['A', 'B'] as const).map((corner) => (
                <td key={corner} className="py-2 pl-2 text-right font-display text-base tabular-nums text-ink">
                  {formatPct(cornerTotal(corner))}
                </td>
              ))}
              <td className="py-2 pl-2 text-right tabular-nums text-muted">100%</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          Lecture : {a.fighter_name} gagne par décision dans {formatPct(line('A', 'dec').probability)} des cas. La colonne
          Total additionne les deux combattants ; la dernière ligne redonne leurs chances de victoire.
        </p>
      </div>

      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Quand le combat se termine</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="border border-line px-3 py-2">
            <p className="text-xs text-muted">Avant la limite (KO ou soumission)</p>
            <p className="font-display text-2xl text-ink">{formatPct(1 - toDecision)}</p>
          </div>
          <div className="border border-line px-3 py-2">
            <p className="text-xs text-muted">Jusqu&apos;aux juges (décision)</p>
            <p className="font-display text-2xl text-ink">{formatPct(toDecision)}</p>
          </div>
        </div>
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {(['A', 'B'] as const).map((corner) => (
            <span key={corner} className="flex items-center gap-1.5">
              <Swatch corner={corner} />
              {name(corner)} l&apos;emporte
            </span>
          ))}
        </p>
        <ul className="mt-2 flex flex-col gap-2">
          {endings.map((ending, i) => (
            <li key={ending.label} className="flex items-center gap-3 text-sm">
              <span className="w-20 shrink-0 text-muted">{ending.label}</span>
              <div
                className="flex h-3 flex-1 overflow-hidden bg-surface-2"
                role="img"
                aria-label={`${ending.label} : ${formatPct(ending.a + ending.b)} au total, dont ${a.fighter_name} ${formatPct(ending.a)} et ${b.fighter_name} ${formatPct(ending.b)}`}
              >
                <div className="fx-bar bg-accent" style={{ width: `${ending.a * 100}%`, animationDelay: `${i * 90}ms` }} />
                <div className="fx-bar bg-accent-2" style={{ width: `${ending.b * 100}%`, animationDelay: `${i * 90}ms` }} />
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums text-ink">{formatPct(ending.a + ending.b)}</span>
              <span className="hidden w-24 shrink-0 text-xs tabular-nums sm:inline">
                <span className="text-accent-strong">{formatPct(ending.a)}</span>
                <span className="text-muted"> + {formatPct(ending.b)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Chaque ligne donne la probabilité que le combat se termine à ce moment-là, quel que soit le vainqueur ; la couleur
          indique qui l&apos;emporte. Le round exact reste difficile à prévoir : il s&apos;écarte peu de la moyenne UFC. Les
          nuls et no contests (environ 2 % des combats) ne sont pas comptés.
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
      return `${favored.fighter_name} a le meilleur bilan de frappes : ${signed(rf.strikeDiffPerMin)} frappe nette par minute à l'UFC, contre ${signed(ro.strikeDiffPerMin)}`;
    case 'control':
      return `${favored.fighter_name} contrôle davantage : ${Math.round(rf.controlShare * 100)} % du temps de contrôle dans ses combats, contre ${Math.round(ro.controlShare * 100)} %`;
    case 'knockdowns':
      return `${other.fighter_name} a été envoyé au tapis ${o.knockdownsAbsorbed} fois en ${Math.round(o.ufcMinutes)} min à l'UFC, ${favored.fighter_name} ${f.knockdownsAbsorbed} fois en ${Math.round(f.ufcMinutes)} min`;
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
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Ce qui fait pencher la balance</p>
      <p className="mt-1 text-xs text-muted">
        Sur le FightScore seul : {a.fighter_name} {baseA} %, {b.fighter_name} {100 - baseA} %.
      </p>
      {factors.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Aucun autre facteur ne pèse vraiment : l&apos;estimation repose sur le FightScore.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {factors.map(([factor, shift]) => {
            const favored = shift > 0 ? a : b;
            return (
              <li key={factor} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-sm sm:flex sm:items-baseline">
                <span className="text-muted sm:w-32 sm:shrink-0">{FACTOR_LABEL[factor]}</span>
                <span className="col-span-2 row-start-2 min-w-0 text-ink sm:flex-1">{factorDetail(factor, favored, favored === a ? b : a)}</span>
                <span className="col-start-2 row-start-1 shrink-0 tabular-nums text-accent-strong">
                  +{Math.round(Math.abs(shift) * 100)} pt{Math.round(Math.abs(shift) * 100) > 1 ? 's' : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {unknown.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Inconnu : {unknown.join(', ')}. {unknown.length > 1 ? 'Ces facteurs ne sont pas pris' : "Ce facteur n'est pas pris"} en compte.
        </p>
      )}
    </div>
  );
}

export default function FightSimulator({
  fighters,
  initialA = null,
  initialB = null,
  prefill = null,
}: {
  fighters: SimulatorFighter[];
  initialA?: number | null;
  initialB?: number | null;
  prefill?: MainEventPrefill | null;
}) {
  const byId = (id: number | null) => (id == null ? null : (fighters.find((f) => f.fighter_id === id) ?? null));
  const [a, setA] = useState<SimulatorFighter | null>(() => byId(initialA));
  const [b, setB] = useState<SimulatorFighter | null>(() => byId(initialB));
  const [copied, setCopied] = useState(false);

  // Event handlers (not an effect) own the URL sync, so there is no loop to
  // worry about; replaceState keeps the history clean and the scroll in place.
  const select = (corner: 'a' | 'b', fighter: SimulatorFighter | null) => {
    const next = { a: corner === 'a' ? fighter : a, b: corner === 'b' ? fighter : b };
    setA(next.a);
    setB(next.b);
    setCopied(false);
    try {
      window.history.replaceState(null, '', buildSimulatorPath({ a: next.a?.fighter_id ?? null, b: next.b?.fighter_id ?? null }));
    } catch {
      // URL sync is best-effort.
    }
  };

  const copyLink = async () => {
    if (!a || !b) return;
    try {
      await navigator.clipboard.writeText(window.location.origin + buildSimulatorPath({ a: a.fighter_id, b: b.fighter_id }));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  // The label only makes sense while the corners are still the prefilled ones.
  const showPrefill = prefill && a?.fighter_id === prefill.a && b?.fighter_id === prefill.b;

  // Men and women's ratings are computed on separate pools that never fight
  // each other, so a mixed matchup would compare numbers that mean nothing
  // together -- once one corner is picked, the other is offered only same-gender.
  const optionsFor = (other: SimulatorFighter | null) =>
    fighters.filter((f) => (!other || isWomen(f) === isWomen(other)) && f.fighter_id !== other?.fighter_id);

  const odds = a && b ? matchupOdds(a, b) : null;
  const rating = odds?.rating ?? null;
  const prediction = odds?.prediction ?? null;
  // Title fights are five rounds: default to that when a champion is in the matchup.
  const [roundsChoice, setRoundsChoice] = useState<3 | 5 | null>(null);
  const rounds = roundsChoice ?? (a?.is_champion || b?.is_champion ? 5 : 3);

  return (
    <div className="flex flex-col gap-6">
      {prefill && showPrefill && (
        <p className="text-xs text-muted">
          Main event de{' '}
          <Link href={`/events/${prefill.eventId}`} className="text-accent-strong hover:underline">
            {prefill.eventName}
          </Link>
          {prefill.eventDate && ` · ${prefill.eventDate}`}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <FighterPicker label="Coin rouge" corner="A" options={optionsFor(b)} selected={a} onSelect={(f) => select('a', f)} />
        <FighterPicker label="Coin ambre" corner="B" options={optionsFor(a)} selected={b} onSelect={(f) => select('b', f)} />
      </div>

      {a && b && odds && rating && prediction ? (
        <>
          <FaceOff
            key={`${a.fighter_id}-${b.fighter_id}`}
            a={faceOffCorner(a)}
            b={faceOffCorner(b)}
            pctA={odds.pctA}
            measures={tapeMeasures(a, b)}
          />
          <TaleOfTheTape a={a} b={b} />
          <div className="border border-line bg-surface p-5">
            <p className="text-sm text-muted">{CONFIDENCE_LABEL[rating.confidence]}</p>
            <FactorsNote a={a} b={b} prediction={prediction} />
            {a.weight_class !== b.weight_class && (
              <p className="mt-1 text-xs text-muted">
                Combattants de catégories différentes ({a.weight_class} / {b.weight_class}) : le FightScore est un seul niveau par
                combattant, mais la différence de poids réelle n&apos;est pas modélisée.
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Durée prévue</span>
              <div className="flex border-2 border-ink">
                {([3, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRoundsChoice(n)}
                    aria-pressed={rounds === n}
                    className={`min-h-11 px-4 font-display uppercase ${rounds === n ? 'bg-ink text-bg' : 'text-ink hover:bg-surface-2'}`}
                  >
                    {n} rounds
                  </button>
                ))}
              </div>
            </div>
            <OutcomeBreakdown a={a} b={b} winA={prediction.winA} rounds={rounds} />
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={copyLink} className="inline-flex min-h-11 items-center px-1 font-mono text-xs font-bold uppercase text-accent-strong hover:underline">
                {copied ? 'Lien copié' : 'Copier le lien'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="border border-dashed border-line p-6 text-center text-sm text-muted">
          Choisis deux combattants pour simuler leur affrontement.
        </p>
      )}
    </div>
  );
}
