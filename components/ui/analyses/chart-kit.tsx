'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

// Hand-rolled SVG charts (the project carries no chart library): each chart
// measures its container and draws at real pixel size, so text stays 11-12px
// at every width instead of scaling with a viewBox.

export const GRID_COLOR = '#262626';
export const AXIS_TEXT_COLOR = '#9a9a9a';
export const SURFACE_COLOR = '#161616';

export function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Measure once up front: ResizeObserver only reports on the next rendered
    // frame, which never comes while the tab is in the background.
    setWidth(Math.floor(element.getBoundingClientRect().width));
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export type TooltipRow = { color?: string; label: string; value: string };
export type TooltipContent = { title: string; rows: TooltipRow[]; footnote?: string };
type TooltipState = (TooltipContent & { x: number; y: number }) | null;

/** Tooltip state + handlers for marks inside a `relative` chart container. */
export function useTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const show = useCallback((content: TooltipContent, x: number, y: number) => setTooltip({ ...content, x, y }), []);
  const hide = useCallback(() => setTooltip(null), []);
  return { tooltip, show, hide };
}

export function ChartTooltip({ tooltip, width }: { tooltip: TooltipState; width: number }) {
  if (!tooltip) return null;
  const half = 90;
  const left = Math.min(Math.max(tooltip.x, half), Math.max(half, width - half));
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 w-max max-w-[180px] -translate-x-1/2 -translate-y-full rounded-md border border-base-border bg-base-bg px-3 py-2 text-xs shadow-lg"
      style={{ left, top: tooltip.y - 8 }}
    >
      <p className="mb-1 text-ink-secondary">{tooltip.title}</p>
      <ul className="flex flex-col gap-0.5">
        {tooltip.rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            {row.color && <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: row.color }} aria-hidden="true" />}
            <span className="font-semibold tabular-nums text-ink-primary">{row.value}</span>
            <span className="text-ink-secondary">{row.label}</span>
          </li>
        ))}
      </ul>
      {tooltip.footnote && <p className="mt-1 text-[11px] text-ink-secondary">{tooltip.footnote}</p>}
    </div>
  );
}

export function ChartFrame({ height, children }: { height: number; children: (width: number) => ReactNode }) {
  const { ref, width } = useChartWidth();
  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && children(width)}
    </div>
  );
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** A bar path with a 4px rounded data end and a square baseline. */
export function columnPath(x: number, y: number, width: number, height: number, radius = 4): string {
  if (height <= 0) return '';
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

export function horizontalBarPath(x: number, y: number, width: number, height: number, radius = 4): string {
  if (width <= 0) return '';
  const r = Math.min(radius, height / 2, width);
  return `M${x},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height - r}Q${x + width},${y + height} ${x + width - r},${y + height}H${x}Z`;
}

/** Clean tick values from 0 to at least `max`. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  const ticks = [];
  for (let value = 0; value < max + step * 0.999; value += step) ticks.push(Number(value.toFixed(10)));
  return ticks;
}
