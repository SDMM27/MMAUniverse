import { Fragment } from 'react';

// Red ticker band (@sdmm/design .sd-marquee): the items twice in one track,
// the second copy hidden from assistive tech. Under prefers-reduced-motion the
// design system stops it and wraps the first copy instead.
export default function Marquee({ items, label }: { items: string[]; label: string }) {
  const run = (hidden: boolean) => (
    <div aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-10 pr-10">
      {items.map((item, i) => (
        <Fragment key={i}>
          <span>{item}</span>
          <span aria-hidden="true">◆</span>
        </Fragment>
      ))}
    </div>
  );

  return (
    <div role="region" aria-label={label} className="overflow-hidden whitespace-nowrap bg-accent py-2 text-accent-ink">
      <div className="sd-marquee font-display text-[15px] uppercase tracking-[0.06em]" style={{ ['--sd-marquee-duration' as string]: '28s' }}>
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
}
