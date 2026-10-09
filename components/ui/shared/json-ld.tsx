import { serializeJsonLd } from '@/data/lib/structured-data';

/** schema.org structured data for search engines (see data/lib/structured-data.ts). */
export default function JsonLd({ data }: { data: Record<string, unknown> | Array<Record<string, unknown>> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
