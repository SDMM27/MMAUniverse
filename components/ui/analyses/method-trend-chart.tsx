'use client';

import { AXIS_TEXT_COLOR, ChartFrame, ChartTooltip, GRID_COLOR, Legend, columnPath, useTooltip } from './chart-kit';
import { METHOD_COLORS, METHOD_LABELS, formatInteger, formatPercent } from './format';

export type MethodYear = { year: number; ko: number; sub: number; dec: number };

const KEYS = ['ko', 'sub', 'dec'] as const;
const HEIGHT = 280;
const MARGIN = { top: 8, right: 8, bottom: 24, left: 40 };
const GAP = 2;

/** 100% stacked columns: how fights ended, year by year. Finishes sit on the baseline so the finish rate reads from it. */
export default function MethodTrendChart({ years }: { years: MethodYear[] }) {
  const { tooltip, show, hide } = useTooltip();

  return (
    <div className="flex flex-col gap-3">
      <Legend items={KEYS.map((key) => ({ color: METHOD_COLORS[key], label: METHOD_LABELS[key] }))} />
      <ChartFrame height={HEIGHT}>
        {(width) => {
          const plotWidth = width - MARGIN.left - MARGIN.right;
          const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
          const slot = plotWidth / years.length;
          const barWidth = Math.max(2, Math.min(24, slot - GAP));
          const labelEvery = slot < 14 ? 10 : 5;

          return (
            <>
              <svg width={width} height={HEIGHT} role="img" aria-label="Répartition des méthodes de victoire par année" onPointerLeave={hide}>
                {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                  const y = MARGIN.top + plotHeight * (1 - tick);
                  return (
                    <g key={tick}>
                      <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y} y2={y} stroke={GRID_COLOR} />
                      <text x={MARGIN.left - 6} y={y} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT_COLOR}>
                        {tick * 100} %
                      </text>
                    </g>
                  );
                })}
                {years.map((point, index) => {
                  const total = point.ko + point.sub + point.dec;
                  if (total === 0) return null;
                  const x = MARGIN.left + index * slot + (slot - barWidth) / 2;
                  const topKey = [...KEYS].reverse().find((key) => point[key] > 0);
                  let cursor = MARGIN.top + plotHeight;
                  const segments = KEYS.map((key) => {
                    const fullHeight = (point[key] / total) * plotHeight;
                    const y = cursor - fullHeight;
                    cursor = y;
                    // The 2px surface gap comes off each segment's top, except the topmost.
                    const drawn = key === topKey ? fullHeight : Math.max(0, fullHeight - GAP);
                    const d = key === topKey ? columnPath(x, y, barWidth, drawn) : `M${x},${y + GAP}h${barWidth}v${drawn}h${-barWidth}Z`;
                    return drawn > 0 ? <path key={key} d={d} fill={METHOD_COLORS[key]} /> : null;
                  });
                  const showTooltip = () =>
                    show(
                      {
                        title: String(point.year),
                        rows: KEYS.map((key) => ({ color: METHOD_COLORS[key], label: METHOD_LABELS[key], value: formatPercent(point[key] / total) })),
                        footnote: `${formatInteger(total)} combats`,
                      },
                      MARGIN.left + index * slot + slot / 2,
                      MARGIN.top,
                    );
                  return (
                    <g key={point.year} className="transition-opacity hover:opacity-80">
                      {segments}
                      <rect x={MARGIN.left + index * slot} y={MARGIN.top} width={slot} height={plotHeight} fill="transparent" onPointerEnter={showTooltip} onPointerMove={showTooltip} />
                      {point.year % labelEvery === 0 && (
                        <text x={x + barWidth / 2} y={HEIGHT - 6} textAnchor="middle" fontSize={11} fill={AXIS_TEXT_COLOR}>
                          {point.year}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
              <ChartTooltip tooltip={tooltip} width={width} />
            </>
          );
        }}
      </ChartFrame>
    </div>
  );
}
