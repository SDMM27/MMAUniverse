'use client';

import { ChartTooltip, Legend, useChartWidth, useTooltip } from './chart-kit';
import { METHOD_COLORS, METHOD_LABELS, formatInteger, formatPercent } from './format';

export type FinishRow = { label: string; ko: number; sub: number; dec: number };

const ROW_HEIGHT = 30;
const BAR_HEIGHT = 16;
const GAP = 2;

/**
 * One horizontal bar per row: KO/TKO then submission segments, so the bar's
 * length is the finish rate. `highlight` names a row to emphasize (e.g. the
 * organization picked in the page filter).
 */
export default function FinishBarList({ rows, ariaLabel, highlight }: { rows: FinishRow[]; ariaLabel: string; highlight?: string }) {
  const { ref, width } = useChartWidth();
  const { tooltip, show, hide } = useTooltip();
  const labelWidth = width < 480 ? 104 : 150;
  const valueWidth = 52;
  const trackWidth = Math.max(0, width - labelWidth - valueWidth);

  return (
    <div className="flex flex-col gap-3">
      <Legend items={(['ko', 'sub'] as const).map((key) => ({ color: METHOD_COLORS[key], label: METHOD_LABELS[key] }))} />
      <div ref={ref} className="relative" style={{ height: rows.length * ROW_HEIGHT }}>
        {width > 0 && (
          <>
            <svg width={width} height={rows.length * ROW_HEIGHT} role="img" aria-label={ariaLabel} onPointerLeave={hide}>
              {rows.map((row, index) => {
                const total = row.ko + row.sub + row.dec;
                const koShare = total > 0 ? row.ko / total : 0;
                const subShare = total > 0 ? row.sub / total : 0;
                const y = index * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
                const koWidth = trackWidth * koShare;
                const subWidth = trackWidth * subShare;
                const r = 4;
                const subX = labelWidth + koWidth + GAP;
                const subDrawn = Math.max(0, subWidth - GAP);
                const showTooltip = () =>
                  show(
                    {
                      title: row.label,
                      rows: [
                        { color: METHOD_COLORS.ko, label: METHOD_LABELS.ko, value: formatPercent(koShare) },
                        { color: METHOD_COLORS.sub, label: METHOD_LABELS.sub, value: formatPercent(subShare) },
                      ],
                      footnote: `${formatInteger(total)} combats`,
                    },
                    labelWidth + koWidth + subWidth / 2,
                    y,
                  );
                return (
                  <g key={row.label} tabIndex={0} onFocus={showTooltip} onBlur={hide} className="outline-none transition-opacity hover:opacity-80 focus-visible:opacity-80">
                    {row.label === highlight && <rect x={0} y={index * ROW_HEIGHT + 4} width={3} height={ROW_HEIGHT - 8} rx={1.5} fill="#ff3b30" />}
                    <text x={row.label === highlight ? 10 : 0} y={y + BAR_HEIGHT / 2} dy="0.32em" fontSize={12} fontWeight={row.label === highlight ? 700 : 400} fill="#f5f5f5">
                      {row.label}
                    </text>
                    <rect x={labelWidth} y={y} width={trackWidth} height={BAR_HEIGHT} rx={r} fill="#1f1f1f" />
                    {koWidth > 0 && <rect x={labelWidth} y={y} width={koWidth} height={BAR_HEIGHT} fill={METHOD_COLORS.ko} />}
                    {subDrawn > 0 && (
                      <path
                        d={`M${subX},${y}H${subX + subDrawn - r}Q${subX + subDrawn},${y} ${subX + subDrawn},${y + r}V${y + BAR_HEIGHT - r}Q${subX + subDrawn},${y + BAR_HEIGHT} ${subX + subDrawn - r},${y + BAR_HEIGHT}H${subX}Z`}
                        fill={METHOD_COLORS.sub}
                      />
                    )}
                    <text x={width} y={y + BAR_HEIGHT / 2} dy="0.32em" textAnchor="end" fontSize={12} fontWeight={600} fill="#f5f5f5" className="tabular-nums">
                      {formatPercent(koShare + subShare, 0)}
                    </text>
                    <rect x={0} y={index * ROW_HEIGHT} width={width} height={ROW_HEIGHT} fill="transparent" onPointerEnter={showTooltip} onPointerMove={showTooltip} />
                  </g>
                );
              })}
            </svg>
            <ChartTooltip tooltip={tooltip} width={width} />
          </>
        )}
      </div>
    </div>
  );
}
