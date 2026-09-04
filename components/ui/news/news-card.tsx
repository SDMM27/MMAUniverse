import NewsThumbnail from '@/components/ui/news/news-thumbnail';
import { NewsArticle } from '@/data/lib/definitions';

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
      className="flex flex-col overflow-hidden rounded-lg border border-base-border bg-base-card transition-colors hover:border-accent"
    >
      <NewsThumbnail src={article.image_url} alt={article.title} className="aspect-video w-full" />
      <div className="flex flex-col gap-1 p-3">
        <span className="font-display text-xs uppercase tracking-wide text-accent">
          {article.organization_abbreviation ?? article.source_id}
        </span>
        <p className="line-clamp-2 font-display text-sm uppercase tracking-wide text-ink-primary">{article.title}</p>
        {article.excerpt && <p className="line-clamp-2 text-xs text-ink-secondary">{article.excerpt}</p>}
        <p className="text-xs text-ink-secondary">{formatRelativeDate(article.published_at)}</p>
      </div>
    </a>
  );
}
