// components/ui/shared/photo-credit.tsx
// The attribution free licenses (CC BY / BY-SA) require: author, license,
// link to the source. Shown under the photo on the fighter page; every other
// place a photo appears is covered by /credits-photos (linked in the footer).
type Credited = {
  photo_author: string | null;
  photo_author_url: string | null;
  photo_license: string | null;
  photo_license_url: string | null;
  photo_source_url: string | null;
};

const linkClass = 'underline-offset-2 hover:text-ink-primary hover:underline';

export function PhotoCredit({ fighter, className = '' }: { fighter: Credited; className?: string }) {
  const author = fighter.photo_author ?? 'Auteur inconnu';
  return (
    <figcaption className={`text-[10px] leading-snug text-ink-secondary ${className}`}>
      Photo :{' '}
      {fighter.photo_source_url ? (
        <a href={fighter.photo_source_url} className={linkClass} rel="noopener noreferrer">
          {author}
        </a>
      ) : (
        author
      )}
      {' · '}
      {fighter.photo_license_url ? (
        <a href={fighter.photo_license_url} className={linkClass} rel="noopener noreferrer license">
          {fighter.photo_license}
        </a>
      ) : (
        fighter.photo_license
      )}
    </figcaption>
  );
}
