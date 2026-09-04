import Link from 'next/link';
import NewsCard from '@/components/ui/news/news-card';
import { NewsArticle } from '@/data/lib/definitions';

export default function NewsSection({
  articles,
}: {
  articles: (NewsArticle & { organization_abbreviation?: string | null })[];
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">Actus</h2>
        <Link href="/actualites" className="text-xs uppercase tracking-wide text-accent hover:underline">
          Voir toutes les actus
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {articles.map((article) => (
          <NewsCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
