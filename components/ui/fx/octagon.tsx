// Octagon badge: ranks, initials. `tone` picks the fill; `shake` makes it
// tremble when its .fx-card parent is hovered.
type Tone = 'accent' | 'accent-2' | 'ink' | 'muted';

const TONES: Record<Tone, string> = {
  accent: 'bg-accent text-accent-ink',
  'accent-2': 'bg-accent-2 text-[#1a1205]',
  ink: 'bg-ink text-bg',
  muted: 'bg-surface-2 text-ink',
};

export function OctBadge({
  children,
  tone = 'muted',
  size = 48,
  shake = false,
  className = '',
}: {
  children: React.ReactNode;
  tone?: Tone;
  size?: number;
  shake?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`fx-oct grid shrink-0 place-items-center font-display leading-none ${TONES[tone]} ${shake ? 'fx-shake' : ''} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {children}
    </span>
  );
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}
