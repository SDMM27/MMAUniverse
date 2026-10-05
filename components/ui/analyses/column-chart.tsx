'use client';

import { AXIS_TEXT_COLOR, ChartFrame, ChartTooltip, GRID_COLOR, columnPath, useTooltip } from './chart-kit';
import { SINGLE_SERIES_COLOR, formatPercent } from './format';

/** `shortLabel` replaces the axis label when columns get narrow; the tooltip always shows `label`. */
export type Column = { label: string; shortLabel?: string; value: number | null; footnote?: string };

const MARGIN = { top: 22, right: 4, bottom: 40, left: 42 };
const NARROW_SLOT = 64;

/**
 * Single-series percentage columns (0-100 %), value on each cap. An optional
 * reference line marks a baseline such as the 50 % coin flip (the page's
 * copy explains it, so it carries no label of its own to collide with caps).
 */
export default function ColumnChart({
  columns,
  ariaLabel,
  tooltipLabel,
  reference,
  height = 220,
}: {
  columns: Column[];
  ariaLabel: string;
  tooltipLabel: string;
  reference?: number;
  height?: number;
}) {
  const { tooltip, show, hide } = useTooltip();

  return (
    <ChartFrame height={height}>
      {(width) => {
        const plotWidth = width - MARGIN.left - MARGIN.right;
        const plotHeight = height - MARGIN.top - MARGIN.bottom;
        const slot = plotWidth / columns.length;
        const barWidth = Math.min(40, slot * 0.6);
        const yOf = (value: number) => MARGIN.top + plotHeight * (1 - value);
        const narrow = slot < NARROW_SLOT;

        return (
          <>
            <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerLeave={hide}>
              {[0, 0.5, 1].map((tick) => (
                <g key={tick}>
                  <line x1={MARGIN.left} x2={width - MARGIN.right} y1={yOf(tick)} y2={yOf(tick)} stroke={GRID_COLOR} />
                  <text x={MARGIN.left - 6} y={yOf(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT_COLOR}>
                    {tick * 100} %
                  </text>
                </g>
              ))}
              {reference !== undefined && (
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={yOf(reference)}
                  y2={yOf(reference)}
                  stroke="#f5f5f5"
                  strokeOpacity={0.55}
                  strokeDasharray="4 4"
                  pointerEvents="none"
                />
              )}
              {columns.map((column, index) => {
                const center = MARGIN.left + index * slot + slot / 2;
                const x = center - barWidth / 2;
                const value = column.value;
                const showTooltip = () =>
                  value !== null &&
                  show({ title: column.label, rows: [{ label: tooltipLabel, value: formatPercent(value) }], footnote: column.footnote }, center, yOf(value));
                return (
                  <g
                    key={column.label}
                    tabIndex={value === null ? undefined : 0}
                    onFocus={showTooltip}
                    onBlur={hide}
                    className="outline-none transition-opacity hover:opacity-80 focus-visible:opacity-80"
                  >
                    {value !== null && (
                      <>
                        <path d={columnPath(x, yOf(value), barWidth, plotHeight * value)} fill={SINGLE_SERIES_COLOR} />
                        <text x={center} y={yOf(value) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#f5f5f5">
                          {formatPercent(value, 0)}
                        </text>
                      </>
                    )}
                    <rect x={center - slot / 2} y={MARGIN.top} width={slot} height={plotHeight} fill="transparent" onPointerEnter={showTooltip} onPointerMove={showTooltip} />
                    <foreignObject x={center - slot / 2} y={height - MARGIN.bottom + 4} width={slot} height={MARGIN.bottom - 4}>
                      <p className="px-0.5 text-center text-[11px] leading-tight text-ink-secondary">{narrow && column.shortLabel ? column.shortLabel : column.label}</p>
                    </foreignObject>
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
