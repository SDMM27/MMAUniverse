'use client';

import { useEffect, useId, useRef } from 'react';
import { initCountUp } from '@sdmm/design/js';

// A number that counts up to its value once it scrolls into view
// (@sdmm/design's initCountUp: 1.6 s, ease-out, final value straight away
// under prefers-reduced-motion). The server renders the final value, so it
// reads right without JavaScript and for crawlers. Decimals follow `value`'s
// own: pass "100.0" to keep one.
export default function CountUp({ value, className = '' }: { value: string; className?: string }) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return initCountUp(`[data-count-id="${CSS.escape(id)}"]`);
  }, [id, value]);

  return (
    <span ref={ref} data-count-id={id} data-count-to={value} className={`tabular-nums ${className}`}>
      {formatFr(value)}
    </span>
  );
}

// Same output as initCountUp's final frame (Intl, document language "fr").
function formatFr(value: string) {
  const decimals = value.includes('.') ? value.split('.')[1].length : 0;
  return new Intl.NumberFormat('fr', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(value));
}
