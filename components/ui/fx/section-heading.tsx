import Link from 'next/link';

// Section title, "fight night" style: big condensed capitals, an optional
// mono caption and an optional link (44px tall touch target).
export default function SectionHeading({
  title,
  id,
  caption,
  href,
  linkLabel,
  as: Tag = 'h2',
}: {
  title: React.ReactNode;
  id?: string;
  caption?: React.ReactNode;
  href?: string;
  linkLabel?: string;
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <Tag id={id} className="font-display text-[clamp(2.25rem,5.5vw,3.5rem)] uppercase leading-[0.9] text-ink">
        {title}
      </Tag>
      {caption && <p className="font-mono text-[11px] uppercase text-muted">{caption}</p>}
      {href && linkLabel && (
        <Link href={href} className="inline-flex min-h-11 shrink-0 items-center font-mono text-xs font-bold uppercase text-accent-strong hover:underline">
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}
