'use client';

import type { PointerEvent } from 'react';
import { AXIS_TEXT_COLOR, ChartFrame, ChartTooltip, GRID_COLOR, SURFACE_COLOR, useTooltip } from '@/components/ui/analyses/chart-kit';
import { SINGLE_SERIES_COLOR } from '@/components/ui/analyses/format';
import { displayEventName, formatEventDate } from '@/data/lib/event-utils';
import type { RatingHistoryPoint } from '@/data/lib/fighter-profile-data';

const HEIGHT = 240;
const MARGIN = { top: 12, right: 12, bottom: 26, left: 44 };
const RESULT_LABELS: Record<string, string> = { win: 'Victoire', loss: 'Défaite', draw: 'Nul', nc: 'No contest' };
const RESULT_COLORS: Record<string, string> = { win: '#199e70', loss: '#d95926' };

const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** Rating after each rated fight, one point per fight, on the engine's raw Glicko scale. */
export default function FighterRatingChart({ history }: { history: RatingHistoryPoint[] }) {
  const { tooltip, show, hide } = useTooltip();
  if (history.length < 2) return null;

  const divisions = Array.from(new Set(history.map((p) => p.weightClass)));
  const times = history.map((p) => toTime(p.date));
  const minTime = times[0];
  const maxTime = times[times.length - 1];
  const values = history.map((p) => p.pointsAfter);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = Math.max(10, (rawMax - rawMin) * 0.1);
  const yMin = Math.floor((rawMin - pad) / 10) * 10;
  const yMax = Math.ceil((rawMax + pad) / 10) * 10;

  return (
    <div>
      <ChartFrame height={HEIGHT}>
        {(width) => {
          const plotWidth = width - MARGIN.left - MARGIN.right;
          const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
          const x = (time: number) => MARGIN.left + (maxTime === minTime ? plotWidth / 2 : ((time - minTime) / (maxTime - minTime)) * plotWidth);
          const y = (value: number) => MARGIN.top + plotHeight * (1 - (value - yMin) / (yMax - yMin));
          const ticks = [0, 1, 2, 3].map((i) => Math.round(yMin + ((yMax - yMin) * i) / 3));
          const path = history.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(times[i]).toFixed(1)},${y(p.pointsAfter).toFixed(1)}`).join('');
          const years = Array.from(new Set(history.map((p) => p.date.slice(0, 4)))).map(Number);
          const yearStep = Math.max(1, Math.ceil(years.length / Math.max(1, Math.floor(plotWidth / 56))));
          const labelledYears = years.filter((_, i) => i % yearStep === 0);

          const showNearest = (event: PointerEvent<SVGRectElement>) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const pointerX = event.clientX - bounds.left + MARGIN.left;
            let nearest = 0;
            for (let i = 1; i < history.length; i++) {
              if (Math.abs(x(times[i]) - pointerX) < Math.abs(x(times[nearest]) - pointerX)) nearest = i;
            }
            const p = history[nearest];
            show(
              {
                title: `${formatEventDate(p.date)} · vs ${p.opponentName}`,
                rows: [
                  { label: 'résultat', value: p.result ? (RESULT_LABELS[p.result] ?? p.result) : 'Inconnu' },
                  { label: 'rating après', value: String(Math.round(p.pointsAfter)) },
                ],
                footnote: divisions.length > 1 ? `${displayEventName(p.eventName)} · ${p.weightClass}` : displayEventName(p.eventName),
              },
              x(times[nearest]),
              y(p.pointsAfter),
            );
          };

          return (
            <>
              <svg width={width} height={HEIGHT} role="img" aria-label="Évolution du rating FightScore après chaque combat" onPointerLeave={hide}>
                {ticks.map((tick) => (
                  <g key={tick}>
                    <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke={GRID_COLOR} />
                    <text x={MARGIN.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT_COLOR}>
                      {tick}
                    </text>
                  </g>
                ))}
                {labelledYears.map((year) => (
                  <text key={year} x={x(Math.min(Math.max(toTime(`${year}-07-01`), minTime), maxTime))} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={AXIS_TEXT_COLOR}>
                    {year}
                  </text>
                ))}
                <path d={path} fill="none" stroke={SINGLE_SERIES_COLOR} strokeWidth={2} strokeLinejoin="round" />
                {history.map((p, i) => (
                  <circle key={p.id} cx={x(times[i])} cy={y(p.pointsAfter)} r={3.5} fill={RESULT_COLORS[p.result ?? ''] ?? AXIS_TEXT_COLOR} stroke={SURFACE_COLOR} strokeWidth={1.5} />
                ))}
                <rect x={MARGIN.left} y={MARGIN.top} width={plotWidth} height={plotHeight} fill="transparent" onPointerEnter={showNearest} onPointerMove={showNearest} />
              </svg>
              <ChartTooltip tooltip={tooltip} width={width} />
            </>
          );
        }}
      </ChartFrame>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary">
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: RESULT_COLORS.win }} aria-hidden="true" />
          Victoire
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: RESULT_COLORS.loss }} aria-hidden="true" />
          Défaite
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: AXIS_TEXT_COLOR }} aria-hidden="true" />
          Nul / no contest
        </li>
      </ul>
    </div>
  );
}
