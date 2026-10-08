// app/analyses/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { ALL_ORGS, DEFAULT_ORG, fetchAnalytics, orgLabel } from '@/data/lib/analytics-data';
import { sumCells, trendMetricValue, type FactorBucket, type TrendCell, type TrendTotals, type WinFactor } from '@/data/lib/analytics';
import MethodTrendChart from '@/components/ui/analyses/method-trend-chart';
import ColumnChart from '@/components/ui/analyses/column-chart';
import FinishBarList from '@/components/ui/analyses/finish-bar-list';
import TrendExplorer from '@/components/ui/analyses/trend-explorer';
import OrgFilter from '@/components/ui/analyses/org-filter';
import ScopeBadge from '@/components/ui/analyses/scope-badge';
import { formatInteger, formatNumber, formatPercent } from '@/components/ui/analyses/format';

// Queries the DB at request time (cached for a few hours in fetchAnalytics)
// rather than at build time -- see data/lib/db.ts.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Analyses · MMA Universe',
  description: 'Les tendances du MMA et ce qui fait gagner un combat, organisation par organisation.',
};

// A bucket needs this many fights before the page draws a conclusion from it,
// and a factor this many in total before its chart is shown at all.
const MIN_BUCKET_FIGHTS = 100;
const MIN_FACTOR_FIGHTS = 300;
const MIN_BAR_FIGHTS = 30;

function Section({ eyebrow, scope, title, intro, children }: { eyebrow: string; scope?: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-xs uppercase tracking-widest text-accent">{eyebrow}</p>
          {scope && <ScopeBadge label={scope} />}
        </div>
        <h2 className="mt-1 font-display text-2xl uppercase tracking-wide text-ink-primary">{title}</h2>
        {intro && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

function Card({ title, badge, caption, children }: { title?: string; badge?: string; caption?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-base-border bg-base-card p-5">
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base uppercase tracking-wide text-ink-primary">{title}</h3>
          {badge && <ScopeBadge label={badge} />}
        </div>
      )}
      {caption && <p className="text-sm leading-relaxed text-ink-secondary">{caption}</p>}
      {children}
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-base-border bg-base-card p-4">
      <p className="text-xs uppercase tracking-wide text-ink-secondary">{label}</p>
      <p className="text-3xl font-semibold text-ink-primary">{value}</p>
      {detail && <p className="text-xs text-ink-secondary">{detail}</p>}
    </div>
  );
}

function rate(bucket: FactorBucket) {
  return bucket.total > 0 ? bucket.wins / bucket.total : 0;
}

function factorFights(factor: WinFactor) {
  return factor.buckets.reduce((total, bucket) => total + bucket.total, 0);
}

/** The bucket furthest from a coin flip, among those with enough fights to say so. */
function strongestBucket(factor: WinFactor): FactorBucket | null {
  return factor.buckets.filter((b) => b.total >= MIN_BUCKET_FIGHTS).sort((a, b) => Math.abs(rate(b) - 0.5) - Math.abs(rate(a) - 0.5))[0] ?? null;
}

function factorCaption(factor: WinFactor): React.ReactNode {
  const strongest = strongestBucket(factor);
  if (!strongest) return null;
  const pct = <strong className="text-ink-primary">{formatPercent(rate(strongest), 0)}</strong>;
  const wins = rate(strongest) < 0.5 ? 'ne gagne que' : 'gagne';
  switch (factor.id) {
    case 'streak':
      return (
        <>
          Après {strongest.label.toLowerCase()}, un combattant {wins} {pct} de ses combats suivants.
        </>
      );
    case 'layoff':
      return (
        <>
          Après une pause de {strongest.label.toLowerCase()}, un combattant {wins} {pct} de ses combats.
        </>
      );
    default:
      return (
        <>
          Avec un écart de {strongest.label.toLowerCase()}, {factor.subject} {wins} {pct} des combats.
        </>
      );
  }
}

function FactorCard({ factor, badge }: { factor: WinFactor; badge?: string }) {
  return (
    <Card title={factor.title} badge={badge} caption={factorCaption(factor)}>
      <ColumnChart
        ariaLabel={`Taux de victoire selon ${factor.title.toLowerCase()}`}
        tooltipLabel={`de victoires pour ${factor.subject}`}
        reference={0.5}
        columns={factor.buckets.map((b) => ({
          label: b.label,
          shortLabel: b.short,
          value: b.total >= MIN_BAR_FIGHTS ? rate(b) : null,
          footnote: `${formatInteger(b.total)} combats`,
        }))}
      />
      {factor.id === 'streak' && <p className="-mt-2 text-[11px] text-ink-secondary">D / V : défaites / victoires d&apos;affilée avant le combat.</p>}
    </Card>
  );
}

function methodsByYear(cube: TrendCell[]) {
  const years = new Map<number, { year: number; ko: number; sub: number; dec: number }>();
  for (const cell of cube) {
    const entry = years.get(cell.year) ?? { year: cell.year, ko: 0, sub: 0, dec: 0 };
    entry.ko += cell.ko;
    entry.sub += cell.sub;
    entry.dec += cell.dec;
    years.set(cell.year, entry);
  }
  return Array.from(years.values()).sort((a, b) => a.year - b.year);
}

function decisionShare(totals: TrendTotals) {
  const decided = totals.ko + totals.sub + totals.dec;
  return decided > 0 ? totals.dec / decided : 0;
}

export default async function Page({ searchParams }: { searchParams: { org?: string | string[] } }) {
  const data = await fetchAnalytics();
  const requested = typeof searchParams.org === 'string' ? searchParams.org : DEFAULT_ORG;
  const orgKey = data.byOrg[requested] ? requested : data.byOrg[DEFAULT_ORG] ? DEFAULT_ORG : ALL_ORGS;
  const org = data.byOrg[orgKey];
  const isUfc = orgKey === DEFAULT_ORG;
  const isAll = orgKey === ALL_ORGS;
  const scope = isAll ? 'Toutes organisations' : org.label;
  const { cube } = org;

  const currentYear = Number(data.asOf.slice(0, 4));
  const recentFrom = currentYear - 4;
  const all = sumCells(cube);
  const recent = sumCells(cube, (c) => c.year >= recentFrom);

  // "Back then" for the methods comparison: 2001-2005 (Zuffa era, unified
  // rules) or the organization's own first five years if it started later.
  const thenFrom = Math.max(org.firstYear, 2001);
  const thenTo = thenFrom + 4;
  const then = sumCells(cube, (c) => c.year >= thenFrom && c.year <= thenTo);
  const hasThen = thenTo < recentFrom && then.ko + then.sub + then.dec >= MIN_BUCKET_FIGHTS;

  const finishOf = (row: { ko: number; sub: number; dec: number }) => (row.ko + row.sub) / Math.max(1, row.ko + row.sub + row.dec);
  const divisionRows = org.divisions
    .map((division) => {
      const totals = sumCells(cube, (c) => c.division === division);
      return { label: division, ko: totals.ko, sub: totals.sub, dec: totals.dec };
    })
    .filter((row) => row.ko + row.sub + row.dec >= MIN_BAR_FIGHTS)
    .sort((a, b) => finishOf(b) - finishOf(a));
  const solidDivisions = divisionRows.filter((row) => row.ko + row.sub + row.dec >= MIN_BUCKET_FIGHTS);
  const topDivision = solidDivisions[0];
  const bottomDivision = solidDivisions[solidDivisions.length - 1];
  const genderNote =
    "Sherdog ne sépare pas les catégories féminines : on les reconstitue à partir des adversaires de chaque combattante, et les quelques combattantes qu'on ne peut pas situer restent comptées avec les hommes.";

  const roundOne = org.rounds[0]?.share ?? 0;
  const championshipRounds = (org.rounds[3]?.share ?? 0) + (org.rounds[4]?.share ?? 0);

  const shownFactors = org.factors.filter((factor) => factorFights(factor) >= MIN_FACTOR_FIGHTS);
  const missingFactors = org.factors.filter((factor) => factorFights(factor) < MIN_FACTOR_FIGHTS);
  const orgRows = data.orgComparison.map((row) => ({ label: orgLabel(row.organization), ko: row.ko, sub: row.sub, dec: row.dec }));

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-14 px-6 py-8">
      <header className="flex flex-col gap-6 border-b border-base-border pb-8">
        <div>
          <p className="font-display text-xs uppercase tracking-widest text-accent">Analyses · Données</p>
          <h1 className="mt-2 font-display text-4xl uppercase leading-none text-ink-primary md:text-5xl">Le MMA en chiffres</h1>
          <p className="mt-3 max-w-2xl text-sm text-ink-secondary">
            Comment les combats se terminent, comment le sport a changé, et ce qui fait vraiment gagner un combat. Les résultats viennent de Sherdog pour
            chaque organisation suivie ; les statistiques détaillées (frappes, takedowns, contrôle, allonge) n&apos;existent que pour l&apos;UFC et sont
            marquées comme telles.
          </p>
        </div>
        <OrgFilter options={data.orgOptions} active={orgKey} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Combats analysés" value={formatInteger(org.fightCount)} detail={`${scope}, de ${org.firstYear} à aujourd’hui`} />
          <Stat
            label="Taux de finish"
            value={formatPercent(trendMetricValue(recent, 'finishRate') ?? 0, 0)}
            detail={`depuis ${recentFrom}, contre ${formatPercent(trendMetricValue(all, 'finishRate') ?? 0, 0)} sur toute la période`}
          />
          <Stat label="Durée moyenne" value={`${formatNumber(trendMetricValue(recent, 'avgMinutes') ?? 0)} min`} detail={`par combat depuis ${recentFrom}`} />
          <Stat label="Finish au 1er round" value={formatPercent(roundOne, 0)} detail="des KO et soumissions" />
        </div>
      </header>

      <Section
        eyebrow="Tendances"
        scope={scope}
        title="Comment les combats se terminent"
        intro={
          <>
            Les décisions représentent {formatPercent(decisionShare(recent), 0)} des combats depuis {recentFrom}
            {hasThen && (
              <>
                , contre {formatPercent(decisionShare(then), 0)} entre {thenFrom} et {thenTo}
              </>
            )}
            .{(isUfc || isAll) && <> Les tout premiers UFC n&apos;avaient ni juges ni limite de temps : presque tout s&apos;y terminait avant la fin.</>}
          </>
        }
      >
        <Card>
          <MethodTrendChart years={methodsByYear(cube)} />
        </Card>
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section
          eyebrow="Tendances"
          scope={scope}
          title="Quand ça s'arrête"
          intro={
            <>
              {formatPercent(roundOne, 0)} des finishes arrivent dès le premier round. Les 4e et 5e rounds, réservés aux combats en 5 rounds (main events,
              titres), n&apos;en concentrent que {formatPercent(championshipRounds, 0)}.
            </>
          }
        >
          <Card>
            <ColumnChart
              ariaLabel="Répartition des finishes par round"
              tooltipLabel="des finishes"
              columns={org.rounds.map((r) => ({ label: `Round ${r.round}`, shortLabel: `R${r.round}`, value: r.share, footnote: `${formatInteger(r.finishes)} finishes` }))}
            />
          </Card>
        </Section>

        <Section
          eyebrow="Tendances"
          scope={scope}
          title="Par catégorie"
          intro={
            topDivision && bottomDivision && topDivision !== bottomDivision ? (
              <>
                Le taux de finish va de {formatPercent(finishOf(topDivision), 0)} en {topDivision.label} à {formatPercent(finishOf(bottomDivision), 0)} en{' '}
                {bottomDivision.label}. {genderNote}
              </>
            ) : (
              genderNote
            )
          }
        >
          <Card>
            <FinishBarList rows={divisionRows} ariaLabel="Taux de finish par catégorie" />
          </Card>
        </Section>
      </div>

      <Section
        eyebrow="Facteurs de victoire"
        scope={scope}
        title="Ce qui fait gagner"
        intro={
          <>
            Pour chaque facteur, la part de combats gagnés selon l&apos;écart entre les deux combattants. La ligne pointillée marque 50 % : un pile ou face.
            L&apos;expérience, la série en cours et l&apos;inactivité se basent sur le palmarès pro complet de chaque combattant, y compris dans les
            organisations qu&apos;on ne suit pas. Ce sont des corrélations, pas une prédiction pour un combat donné : le{' '}
            <Link href="/simulateur" className="text-accent hover:underline">
              simulateur
            </Link>{' '}
            combine ces signaux avec le FightScore.
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shownFactors.slice(0, 1).map((factor) => (
            <FactorCard key={factor.id} factor={factor} />
          ))}
          <FactorCard factor={data.ufcStats.reach} badge="UFC uniquement" />
          {shownFactors.slice(1).map((factor) => (
            <FactorCard key={factor.id} factor={factor} />
          ))}
        </div>
        {missingFactors.length > 0 && (
          <p className="text-sm text-ink-secondary">
            Pas assez de données pour {missingFactors.map((factor) => factor.title.charAt(0).toLowerCase() + factor.title.slice(1)).join(', ')} : la date de
            naissance, la taille ou le palmarès ne sont pas connus pour la plupart des combattants de cette organisation.
          </p>
        )}
      </Section>

      {orgRows.length > 1 && (
        <Section
          eyebrow="Au-delà de l'UFC"
          scope="Toutes organisations"
          title="Les organisations comparées"
          intro={
            <>
              Taux de finish depuis {data.orgComparisonSince} dans chaque organisation suivie ayant assez de combats sur la période. Le niveau
              d&apos;opposition varie beaucoup d&apos;une organisation à l&apos;autre, ce qui pèse aussi sur la façon dont les combats se terminent.
            </>
          }
        >
          <Card>
            <FinishBarList rows={orgRows} ariaLabel="Taux de finish par organisation" highlight={isAll ? undefined : org.label} />
          </Card>
        </Section>
      )}

      <Section
        eyebrow="Explorateur"
        title="À vous de creuser"
        intro="Choisissez une mesure, une catégorie et une période. Les années avec trop peu de combats sont laissées vides plutôt que de tirer des conclusions sur une poignée de soirées."
      >
        <Card>
          <TrendExplorer
            orgs={data.orgOptions.map(({ key }) => {
              const { label, cube: orgCube, divisions } = data.byOrg[key];
              return { key, label, cube: orgCube, divisions };
            })}
            initialOrg={orgKey}
            ufcKey={DEFAULT_ORG}
            statsCube={data.ufcStats.cube}
            statsDivisions={data.ufcStats.divisions}
            asOf={data.asOf}
          />
        </Card>
      </Section>

      <footer className="border-t border-base-border pt-6 text-xs leading-relaxed text-ink-secondary">
        Sources : Sherdog pour les résultats de chaque organisation, la taille, la date de naissance et le palmarès pro des combattants ; UFCStats.com
        pour les statistiques détaillées et l&apos;allonge, publiées uniquement pour l&apos;UFC. Les no contests, nuls et disqualifications sont exclus
        des taux de finish. Données mises à jour automatiquement ; dernier combat pris en compte le {data.lastDate.split('-').reverse().join('/')}.
      </footer>
    </main>
  );
}
