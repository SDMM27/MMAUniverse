import { NewsArticle } from '@/data/lib/definitions';
import { NEWS_SOURCE_NAMES } from '@/data/news/sources.config';

function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffHours = Math.round(diffMs / (60 * 60 * 1000));
  if (diffHours < 1) return "à l'instant";
  if (diffHours < 24) return `il y a ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `il y a ${diffDays} j`;
}

export default function NewsCard({
  article,
}: {
  article: NewsArticle & { organization_abbreviation?: string | null };
}) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="fx-card flex min-w-0 flex-col overflow-hidden border border-line bg-surface hover:border-accent"
    >
      <div className="flex flex-col gap-1 p-3">
        <span className="font-mono text-[11px] font-bold uppercase text-accent-strong">
          {[article.organization_abbreviation, NEWS_SOURCE_NAMES[article.source_id] ?? article.source_id]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <p className="line-clamp-3 font-display text-base uppercase leading-tight text-ink [overflow-wrap:anywhere]">{article.title}</p>
        <p className="font-mono text-[11px] uppercase text-muted">{formatRelativeDate(article.published_at)}</p>
      </div>
    </a>
  );
}
