import NewsCard from '@/components/ui/news/news-card';
import SectionHeading from '@/components/ui/fx/section-heading';
import { NewsArticle } from '@/data/lib/definitions';

export default function NewsSection({
  articles,
}: {
  articles: (NewsArticle & { organization_abbreviation?: string | null })[];
}) {
  return (
    <section>
      <SectionHeading title="Actus" href="/actualites" linkLabel="Voir toutes les actus" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {articles.map((article) => (
          <NewsCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
