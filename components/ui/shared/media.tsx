'use client';

import { useState } from 'react';
import Image from 'next/image';
import { withHigherResolution } from '@/data/lib/image-utils';

// Simple person silhouette — shown whenever there's no image_url in the DB, or the
// URL we do have fails to load (dead scrape, moved asset, etc.). A plain empty box
// gave no indication that a photo was ever expected there.
function SilhouetteIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 12c2.76 0 5-2.69 5-6s-2.24-6-5-6-5 2.69-5 6 2.24 6 5 6Zm0 2c-4.42 0-8 2.69-8 6v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-3.31-3.58-6-8-6Z" />
    </svg>
  );
}

export function CoverImage({
  src,
  alt,
  className = '',
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
}: {
  src?: string | null;
  alt: string;
  className?: string;
  /** Passed straight to next/image — tune per usage so it isn't always fetching for a full-bleed hero. */
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-base-border ${className}`} aria-hidden="true">
        <SilhouetteIcon className="h-1/3 w-1/3 text-ink-secondary/40" />
      </div>
    );
  }

  return (
    // Two nested divs rather than one: callers pass positioning classes for
    // *this* box (e.g. `absolute inset-0`, `aspect-square w-full`, `h-16 w-16`)
    // — mixing a caller-supplied `absolute`/`static` with a `relative` we add
    // ourselves on the same element would have one silently overriding the
    // other. The inner div is always position:relative so <Image fill> (which
    // requires a positioned ancestor) has one to attach to, independent of
    // whatever position the outer box itself needs to be.
    <div className={`overflow-hidden bg-base-border ${className}`}>
      <div className="relative h-full w-full">
        <Image
          src={withHigherResolution(src)}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  );
}
