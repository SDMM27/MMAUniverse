import { ImageResponse } from 'next/og';
import { getFighterRatings, resolveFighterRoute } from '@/data/lib/fighter-page-data';

// Share card of a fighter page (name, division, record, FightScore). Every
// external dependency is optional: if the database, the photo or a rating is
// unavailable the card still renders with whatever text we have.

export const alt = 'Fiche du combattant sur MMA Universe';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BACKGROUND = '#0a0a0a';
const CARD = '#161616';
const ACCENT = '#ff3b30'; // tailwind.config.ts accent
const INK = '#f5f5f5';
const INK_SECONDARY = '#9a9a9a';

type CardData = {
  name: string;
  division: string | null;
  record: string | null;
  score: string | null;
  photo: string | null;
};

// satori only decodes PNG/JPEG/GIF; remote photos are fetched here (short timeout)
// and inlined, so a slow or missing photo can never fail the whole image.
async function loadPhoto(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
    const type = response.headers.get('content-type')?.split(';')[0] ?? '';
    if (!response.ok || !/^image\/(jpeg|png|gif)$/.test(type)) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 2_000_000) return null;
    return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
  } catch {
    return null;
  }
}

async function loadCardData(segment: string): Promise<CardData | null> {
  try {
    const route = await resolveFighterRoute(segment);
    if (route.kind !== 'found') return null;
    const { fighter } = route;
    const [ratings, photo] = await Promise.all([
      getFighterRatings(String(fighter.id)).catch(() => []),
      loadPhoto(fighter.image_url),
    ]);
    const score = ratings[0] && Number.isFinite(Number(ratings[0].display_score)) ? Number(ratings[0].display_score).toFixed(1) : null;
    return {
      name: fighter.name,
      division: [fighter.organization_abbreviation, fighter.weight_class].filter(Boolean).join(' · ') || null,
      record: fighter.record || null,
      score,
      photo,
    };
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: { slug: string } }) {
  const data = await loadCardData(params.slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: BACKGROUND,
          color: INK,
          padding: 56,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, paddingRight: 40 }}>
          <div style={{ display: 'flex', color: ACCENT, fontSize: 34, fontWeight: 700, letterSpacing: 4 }}>MMA UNIVERSE</div>
          {data ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {data.division && (
                <div style={{ display: 'flex', color: ACCENT, fontSize: 32, textTransform: 'uppercase', letterSpacing: 2 }}>
                  {data.division}
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  fontSize: data.name.length > 22 ? 64 : 82,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  textTransform: 'uppercase',
                  marginTop: 12,
                }}
              >
                {data.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 36 }}>
                {data.record && (
                  <div style={{ display: 'flex', flexDirection: 'column', marginRight: 56 }}>
                    <div style={{ display: 'flex', color: INK_SECONDARY, fontSize: 24 }}>Bilan</div>
                    <div style={{ display: 'flex', fontSize: 56, fontWeight: 700 }}>{data.record}</div>
                  </div>
                )}
                {data.score && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', color: INK_SECONDARY, fontSize: 24 }}>FightScore</div>
                    <div style={{ display: 'flex', fontSize: 56, fontWeight: 700, color: ACCENT }}>{data.score}</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
              Fiches de combattants, classements et FightScore
            </div>
          )}
          <div style={{ display: 'flex', color: INK_SECONDARY, fontSize: 26 }}>Événements, résultats et classements MMA</div>
        </div>
        {data?.photo && (
          <div
            style={{
              display: 'flex',
              width: 392,
              height: '100%',
              borderRadius: 24,
              overflow: 'hidden',
              background: CARD,
              border: '2px solid #262626',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.photo} alt="" width={392} height={518} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}
