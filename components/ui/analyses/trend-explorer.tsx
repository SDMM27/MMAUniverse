'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  OTHER_DIVISION,
  TREND_METRICS,
  sumCells,
  trendMetricValue,
  type TrendCell,
  type TrendMetric,
  type TrendMetricId,
} from '@/data/lib/analytics';
import { AXIS_TEXT_COLOR, ChartFrame, ChartTooltip, GRID_COLOR, SURFACE_COLOR, horizontalBarPath, niceTicks, useTooltip } from './chart-kit';
import { SINGLE_SERIES_COLOR, formatInteger, formatNumber, formatPercent } from './format';
import ScopeBadge from './scope-badge';

type View = 'year' | 'division';
/** `note` flags a year only partly inside a rolling window (shown in the tooltip). */
type Point = { label: string; value: number | null; fights: number; note?: string };

// Below this many fights a year's value is noise (the early 1990s had a
// handful of events a year), so the line breaks rather than spikes.
const MIN_FIGHTS_PER_POINT = 12;

const selectClass =
  'h-9 rounded-md border border-base-border bg-base-card px-2 text-sm text-ink-primary focus:border-accent focus:outline-none';

function formatMetric(metric: TrendMetric, value: number): string {
  return metric.unit === 'percent' ? formatPercent(value) : formatNumber(value);
}

/** One organization's results (Sherdog), as the explorer's organization select offers them. */
export type ExplorerOrg = { key: string; label: string; cube: TrendCell[]; divisions: string[] };

type ExplorerProps = {
  orgs: ExplorerOrg[];
  /** The page filter's organization: the explorer starts there and follows it when it changes. */
  initialOrg: string;
  /** Key of the organization UFCStats covers. */
  ufcKey: string;
  /** Detailed stats (UFCStats), UFC only whatever organization is picked. */
  statsCube: TrendCell[];
  statsDivisions: string[];
  /** "YYYY-MM-DD" the data was computed on; "5 ans" / "10 ans" count back from it. */
  asOf: string;
};

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dayMonthFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function TrendExplorer({ orgs, initialOrg, ufcKey, statsCube, statsDivisions, asOf }: ExplorerProps) {
  const currentYear = Number(asOf.slice(0, 4));
  const firstYear = [statsCube, ...orgs.map((o) => o.cube)].reduce(
    (min, cube) => cube.reduce((m, cell) => Math.min(m, cell.year), min),
    currentYear,
  );
  const years = useMemo(() => Array.from({ length: currentYear - firstYear + 1 }, (_, i) => firstYear + i), [firstYear, currentYear]);

  const [orgKey, setOrgKey] = useState(initialOrg);
  useEffect(() => setOrgKey(initialOrg), [initialOrg]);
  const org = orgs.find((o) => o.key === orgKey) ?? orgs[0];
  const orgLabel = org.label;
  const isUfc = org.key === ufcKey;

  const [metricId, setMetricId] = useState<TrendMetricId>('finishRate');
  const [view, setView] = useState<View>('year');
  const [divisionChoice, setDivisionChoice] = useState('all');
  const [fromYear, setFromYear] = useState(firstYear);
  const [toYear, setToYear] = useState(currentYear);
  // "5 ans" / "10 ans" are rolling windows back from asOf, not calendar years:
  // the cubes split each year at asOf's day, so the first year only counts
  // from that day on.
  const [rollingYears, setRollingYears] = useState<number | null>(null);

  const metric = TREND_METRICS.find((m) => m.id === metricId)!;
  const isStats = metric.source === 'ufcstats';
  const cube = isStats ? statsCube : org.cube;
  const divisions = isStats ? statsDivisions : org.divisions;
  // Sherdog doesn't separate men's and women's divisions, so the gender
  // filters only exist for UFCStats metrics; a choice the current source
  // can't honor falls back to "Toutes" rather than an empty chart.
  const divisionOptions = [...(isStats ? ['men', 'women'] : []), ...divisions];
  const divisionFilter = divisionOptions.includes(divisionChoice) ? divisionChoice : 'all';

  const asOfDate = new Date(`${asOf}T00:00:00Z`);
  const windowStart = (years: number) => {
    const start = new Date(asOfDate);
    start.setUTCFullYear(currentYear - years);
    return start;
  };
  const presets: { label: string; from: number; rolling: number | null; title: string }[] = [
    { label: 'Tout', from: firstYear, rolling: null, title: `${firstYear} à aujourd’hui` },
    { label: 'Depuis 2005', from: 2005, rolling: null, title: '2005 à aujourd’hui' },
    { label: '10 ans', from: currentYear - 10, rolling: 10, title: `Du ${dayFormat.format(windowStart(10))} à aujourd’hui` },
    { label: '5 ans', from: currentYear - 5, rolling: 5, title: `Du ${dayFormat.format(windowStart(5))} à aujourd’hui` },
  ];
  const yearLabel = (year: number) => (year === currentYear ? `${year} (en cours)` : String(year));

  const keepDivision = (division: string) => {
    if (divisionFilter === 'all') return true;
    if (divisionFilter === 'men') return division !== OTHER_DIVISION && !division.startsWith("Women's");
    if (divisionFilter === 'women') return division.startsWith("Women's");
    return division === divisionFilter;
  };
  const inSlice = (cell: TrendCell) =>
    cell.year >= fromYear &&
    cell.year <= toYear &&
    (rollingYears === null || cell.year !== fromYear || cell.afterCutoff) &&
    keepDivision(cell.division);
  const yearNote = (year: number) => {
    if (rollingYears !== null && year === fromYear) return `à partir du ${dayMonthFormat.format(asOfDate)}`;
    if (year === currentYear) return 'année en cours';
    return undefined;
  };

  const points: Point[] = useMemo(() => {
    if (view === 'year') {
      const byYear = years
        .filter((year) => year >= fromYear && year <= toYear)
        .map((year) => {
          const totals = sumCells(cube, (cell) => cell.year === year && inSlice(cell));
          return {
            label: String(year),
            value: totals.fights >= MIN_FIGHTS_PER_POINT ? trendMetricValue(totals, metricId) : null,
            fights: totals.fights,
            note: yearNote(year),
          };
        });
      // A division created in 2014 shouldn't leave twenty empty years on the axis.
      const first = byYear.findIndex((point) => point.fights > 0);
      return first === -1 ? [] : byYear.slice(first);
    }
    return divisions
      .filter(keepDivision)
      .map((division) => {
        const totals = sumCells(cube, (cell) => cell.division === division && inSlice(cell));
        return { label: division, value: totals.fights >= MIN_FIGHTS_PER_POINT ? trendMetricValue(totals, metricId) : null, fights: totals.fights };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cube, divisions, years, view, metricId, divisionFilter, fromYear, toYear, rollingYears]);

  const sliceTotals = sumCells(cube, inSlice);
  const sliceValue = trendMetricValue(sliceTotals, metricId);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-secondary">
          Mesure
          <select className={selectClass} value={metricId} onChange={(e) => setMetricId(e.target.value as TrendMetricId)}>
            <optgroup label={`Résultats · ${orgLabel}`}>
              {TREND_METRICS.filter((m) => m.source === 'results').map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Statistiques détaillées · UFC uniquement">
              {TREND_METRICS.filter((m) => m.source === 'ufcstats').map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-secondary">
          Organisation
          {/* UFCStats metrics only exist for the UFC: the select shows it, locked, rather than a choice that wouldn't apply. */}
          <select
            className={`${selectClass} disabled:opacity-60`}
            value={isStats ? ufcKey : org.key}
            disabled={isStats}
            onChange={(e) => setOrgKey(e.target.value)}
          >
            {orgs.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-secondary">
          Catégorie
          <select className={selectClass} value={divisionFilter} onChange={(e) => setDivisionChoice(e.target.value)}>
            <option value="all">Toutes</option>
            {isStats && (
              <>
                <option value="men">Hommes</option>
                <option value="women">Femmes</option>
              </>
            )}
            {divisions.map((division) => (
              <option key={division} value={division}>
                {division}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-secondary">
          De
          <select
            className={selectClass}
            value={fromYear}
            onChange={(e) => {
              setRollingYears(null);
              setFromYear(Math.min(Number(e.target.value), toYear));
            }}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {yearLabel(year)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-ink-secondary">
          À
          <select
            className={selectClass}
            value={toYear}
            onChange={(e) => {
              setRollingYears(null);
              setToYear(Math.max(Number(e.target.value), fromYear));
            }}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {yearLabel(year)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1" role="group" aria-label="Période rapide">
          {presets.map((preset) => {
            const active = rollingYears === preset.rolling && fromYear === preset.from && toYear === currentYear;
            return (
              <button
                key={preset.label}
                title={preset.title}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setRollingYears(preset.rolling);
                  setFromYear(preset.from);
                  setToYear(currentYear);
                }}
                className={`h-9 rounded-md border px-3 text-xs uppercase tracking-wide transition-colors ${
                  active ? 'border-accent text-accent' : 'border-base-border text-ink-secondary hover:text-ink-primary'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
            <ScopeBadge label={isStats ? 'UFC uniquement' : orgLabel === 'Toutes' ? 'Toutes organisations' : orgLabel} />
            {metric.description}
          </p>
          {isStats && !isUfc && (
            <p className="mt-1 text-xs text-ink-secondary">
              Les statistiques détaillées n&apos;existent que pour l&apos;UFC : le filtre « {orgLabel} » ne s&apos;applique pas à cette mesure.
            </p>
          )}
          <p className="mt-2 text-3xl font-semibold text-ink-primary">
            {sliceValue === null ? '—' : formatMetric(metric, sliceValue)}
            <span className="ml-2 text-sm font-normal text-ink-secondary">
              {rollingYears !== null ? `du ${dayFormat.format(windowStart(rollingYears))} à aujourd’hui` : 'sur la sélection'} ·{' '}
              {formatInteger(sliceTotals.fights)} combats
            </span>
          </p>
        </div>
        <div className="flex rounded-md border border-base-border p-0.5" role="group" aria-label="Vue">
          {(
            [
              ['year', 'Par année'],
              ['division', 'Par catégorie'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={`rounded px-3 py-1.5 text-xs uppercase tracking-wide transition-colors ${
                view === value ? 'bg-accent text-white' : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'year' ? <YearLine points={points} metric={metric} /> : <DivisionBars points={points} metric={metric} />}

      <details className="text-sm">
        <summary className="cursor-pointer text-xs uppercase tracking-wide text-ink-secondary hover:text-ink-primary">Voir les données</summary>
        <div className="mt-3 max-h-72 overflow-auto rounded-md border border-base-border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-base-card text-xs uppercase tracking-wide text-ink-secondary">
              <tr>
                <th className="px-3 py-2 font-normal">{view === 'year' ? 'Année' : 'Catégorie'}</th>
                <th className="px-3 py-2 text-right font-normal">{metric.label}</th>
                <th className="px-3 py-2 text-right font-normal">Combats</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {points.map((point) => (
                <tr key={point.label} className="border-t border-base-border">
                  <td className="px-3 py-1.5">{point.label}</td>
                  <td className="px-3 py-1.5 text-right">{point.value === null ? '—' : formatMetric(metric, point.value)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-secondary">{formatInteger(point.fights)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

const LINE_HEIGHT = 300;
const LINE_MARGIN = { top: 16, right: 16, bottom: 24, left: 48 };

function YearLine({ points, metric }: { points: Point[]; metric: TrendMetric }) {
  const { tooltip, show, hide } = useTooltip();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  const ticks = niceTicks(values.length > 0 ? Math.max(...values) : 1);
  const yMax = ticks[ticks.length - 1] || 1;
  const tickLabel = (tick: number) => (metric.unit === 'percent' ? `${Math.round(tick * 100)} %` : formatNumber(tick).replace(',0', ''));

  if (values.length === 0) {
    return <p className="py-16 text-center text-sm text-ink-secondary">Pas assez de combats sur cette sélection.</p>;
  }

  return (
    <ChartFrame height={LINE_HEIGHT}>
      {(width) => {
        const plotWidth = width - LINE_MARGIN.left - LINE_MARGIN.right;
        const plotHeight = LINE_HEIGHT - LINE_MARGIN.top - LINE_MARGIN.bottom;
        const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;
        const xOf = (index: number) => LINE_MARGIN.left + (points.length > 1 ? index * step : plotWidth / 2);
        const yOf = (value: number) => LINE_MARGIN.top + plotHeight * (1 - value / yMax);
        const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotWidth / 56))));

        // Break the line wherever a year has too few fights.
        const runs: { index: number; value: number }[][] = [];
        points.forEach((point, index) => {
          if (point.value === null) return;
          const last = runs[runs.length - 1];
          if (last && last[last.length - 1].index === index - 1) last.push({ index, value: point.value });
          else runs.push([{ index, value: point.value }]);
        });
        const lastIndex = runs[runs.length - 1].at(-1)!.index;

        const onMove = (event: React.PointerEvent<SVGRectElement>) => {
          // The hit rect starts half a step left of the first point, so each
          // point owns the band [index * step, (index + 1) * step) of it.
          const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
          const index = Math.max(0, Math.min(points.length - 1, step > 0 ? Math.floor(x / step) : 0));
          const point = points[index];
          setHoverIndex(index);
          show(
            {
              title: point.label,
              rows: [{ color: SINGLE_SERIES_COLOR, label: metric.label, value: point.value === null ? '—' : formatMetric(metric, point.value) }],
              footnote: [point.value === null ? `${point.fights} combats : trop peu pour conclure` : `${formatInteger(point.fights)} combats`, point.note]
                .filter(Boolean)
                .join(' · '),
            },
            xOf(index),
            point.value === null ? LINE_MARGIN.top + plotHeight / 2 : yOf(point.value),
          );
        };

        return (
          <>
            <svg width={width} height={LINE_HEIGHT} role="img" aria-label={`${metric.label} par année`}>
              {ticks.map((tick) => (
                <g key={tick}>
                  <line x1={LINE_MARGIN.left} x2={width - LINE_MARGIN.right} y1={yOf(tick)} y2={yOf(tick)} stroke={GRID_COLOR} />
                  <text x={LINE_MARGIN.left - 6} y={yOf(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT_COLOR}>
                    {tickLabel(tick)}
                  </text>
                </g>
              ))}
              {points.map((point, index) =>
                index % labelEvery === 0 ? (
                  <text key={point.label} x={xOf(index)} y={LINE_HEIGHT - 6} textAnchor="middle" fontSize={11} fill={AXIS_TEXT_COLOR}>
                    {point.label}
                  </text>
                ) : null,
              )}
              {runs.map((run) => {
                const d = run.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.index)},${yOf(p.value)}`).join('');
                const area = `${d}L${xOf(run[run.length - 1].index)},${yOf(0)}L${xOf(run[0].index)},${yOf(0)}Z`;
                return (
                  <g key={run[0].index}>
                    <path d={area} fill={SINGLE_SERIES_COLOR} fillOpacity={0.1} />
                    <path d={d} fill="none" stroke={SINGLE_SERIES_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    {run.length === 1 && <circle cx={xOf(run[0].index)} cy={yOf(run[0].value)} r={3} fill={SINGLE_SERIES_COLOR} />}
                  </g>
                );
              })}
              {hoverIndex !== null && hoverIndex < points.length && (
                <g pointerEvents="none">
                  <line x1={xOf(hoverIndex)} x2={xOf(hoverIndex)} y1={LINE_MARGIN.top} y2={yOf(0)} stroke={AXIS_TEXT_COLOR} strokeOpacity={0.5} />
                  {points[hoverIndex].value !== null && (
                    <circle cx={xOf(hoverIndex)} cy={yOf(points[hoverIndex].value!)} r={5} fill={SINGLE_SERIES_COLOR} stroke={SURFACE_COLOR} strokeWidth={2} />
                  )}
                </g>
              )}
              {/* End-of-line value: the one direct label. */}
              <circle cx={xOf(lastIndex)} cy={yOf(points[lastIndex].value!)} r={4} fill={SINGLE_SERIES_COLOR} stroke={SURFACE_COLOR} strokeWidth={2} />
              <rect
                x={LINE_MARGIN.left - step / 2}
                y={LINE_MARGIN.top}
                width={plotWidth + step}
                height={plotHeight}
                fill="transparent"
                onPointerMove={onMove}
                onPointerLeave={() => {
                  hide();
                  setHoverIndex(null);
                }}
              />
            </svg>
            <ChartTooltip tooltip={tooltip} width={width} />
          </>
        );
      }}
    </ChartFrame>
  );
}

function DivisionBars({ points, metric }: { points: Point[]; metric: TrendMetric }) {
  const { tooltip, show, hide } = useTooltip();
  const rowHeight = 30;
  const barHeight = 16;
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  const max = values.length > 0 ? Math.max(...values) : 1;

  return (
    <ChartFrame height={points.length * rowHeight}>
      {(width) => {
        const labelWidth = width < 480 ? 130 : 170;
        const valueWidth = 60;
        const track = Math.max(0, width - labelWidth - valueWidth);
        return (
          <>
            <svg width={width} height={points.length * rowHeight} role="img" aria-label={`${metric.label} par catégorie`} onPointerLeave={hide}>
              {points.map((point, index) => {
                const y = index * rowHeight + (rowHeight - barHeight) / 2;
                const barWidth = point.value === null ? 0 : (point.value / max) * track;
                const showTooltip = () =>
                  show(
                    {
                      title: point.label,
                      rows: [{ color: SINGLE_SERIES_COLOR, label: metric.label, value: point.value === null ? '—' : formatMetric(metric, point.value) }],
                      footnote: `${formatInteger(point.fights)} combats`,
                    },
                    labelWidth + barWidth / 2,
                    y,
                  );
                return (
                  <g key={point.label} tabIndex={0} onFocus={showTooltip} onBlur={hide} className="outline-none transition-opacity hover:opacity-80 focus-visible:opacity-80">
                    <text x={0} y={y + barHeight / 2} dy="0.32em" fontSize={12} fill="#f5f5f5">
                      {point.label}
                    </text>
                    <path d={horizontalBarPath(labelWidth, y, barWidth, barHeight)} fill={SINGLE_SERIES_COLOR} />
                    <text x={labelWidth + barWidth + 6} y={y + barHeight / 2} dy="0.32em" fontSize={12} fontWeight={600} fill="#f5f5f5" className="tabular-nums">
                      {point.value === null ? '—' : formatMetric(metric, point.value)}
                    </text>
                    <rect x={0} y={index * rowHeight} width={width} height={rowHeight} fill="transparent" onPointerEnter={showTooltip} onPointerMove={showTooltip} />
                  </g>
                );
              })}
            </svg>
            <ChartTooltip tooltip={tooltip} width={width} />
          </>
        );
      }}
    </ChartFrame>
  );
}
