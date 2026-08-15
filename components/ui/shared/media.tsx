export function CoverImage({
  src,
  alt,
  className = '',
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return <div className={`bg-base-border ${className}`} aria-hidden="true" />;
  }

  return <img src={src} alt={alt} className={`object-cover ${className}`} />;
}
