'use client';

import { useState } from 'react';

// Generic newspaper glyph — shown whenever the article has no image_url, or
// the URL we do have fails to load. Same fallback pattern as
// components/ui/shared/media.tsx's SilhouetteIcon, different glyph since this
// isn't a person.
function NewspaperIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4 4a1 1 0 0 0-1 1v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V9a1 1 0 0 0-1-1h-2V5a1 1 0 0 0-1-1H4Zm12 4V6H5v12a.5.5 0 0 0 .5.5H16V8Zm2 0v10.5a.5.5 0 0 0 .5-.5V8h-.5ZM6.5 8.5h6v2h-6v-2Zm0 3.5h6v1.5h-6V12Zm0 3h9v1.5h-9V15Z" />
    </svg>
  );
}

export default function NewsThumbnail({
  src,
  alt,
  className = '',
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-base-border ${className}`} aria-hidden="true">
        <NewspaperIcon className="h-1/3 w-1/3 text-ink-secondary/40" />
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-base-border ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- external hosts vary
          per news source and can't all be pre-registered in next.config.mjs's
          images.remotePatterns, so next/image isn't usable here. */}
      <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} />
    </div>
  );
}
