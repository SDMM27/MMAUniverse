// app/classement-calcule/methodologie/page.tsx
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg uppercase tracking-wide text-ink-primary">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-secondary">{children}</div>
    </section>
  );
}

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col gap-8 p-6">
      <div>
        <Link href="/classement-calcule" className="text-xs uppercase tracking-wide text-accent hover:underline">
          ← Retour au classement
        </Link>
        <h1 className="mt-2 font-display text-2xl uppercase tracking-wide text-ink-primary">Méthodologie</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
          Le classement calculé (UFC uniquement pour l&apos;instant) repose sur les statistiques réelles de chaque
          combat, pas sur un vote ou l&apos;avis d&apos;une organisation. Voici comment le score de chaque combattant
          est obtenu.
        </p>
      </div>

      <Section title="1. La dominance de chaque combat">
        <p>
          Chaque victoire reçoit un score de dominance entre 0 et 1, calculé à partir des statistiques réelles du
          combat : qui a remporté le plus de rounds, l&apos;écart de frappes significatives, le temps de contrôle, et
          la méthode de victoire.
        </p>
        <p>
          Finir le combat (KO/TKO ou soumission) compte pour beaucoup — ça retire toute chance à l&apos;adversaire de
          revenir dans le combat. Mais une décision où le vainqueur domine clairement tous les rounds est aussi notée
          comme très dominante, presque au niveau d&apos;un finish : le nombre de rounds gagnés pèse autant que la
          méthode dans le calcul.
        </p>
        <p className="rounded-lg border border-base-border bg-base-card p-3 text-xs">
          <strong className="text-ink-primary">Important :</strong> « qui a gagné chaque round » est une{' '}
          <strong className="text-ink-primary">estimation</strong> calculée à partir des statistiques brutes (frappes,
          contrôle, coups reçus), pas les vraies cartes des juges — celles-ci ne sont pas publiées de façon
          exploitable. C&apos;est une approximation raisonnable, pas un fait officiel.
        </p>
      </Section>

      <Section title="2. Le score qui s'accumule au fil de la carrière">
        <p>
          Chaque combattant part d&apos;un score proche de zéro et le fait grandir combat après combat. Battre un
          adversaire qui a déjà un score élevé rapporte beaucoup plus que battre un débutant — c&apos;est ce qui fait
          qu&apos;une victoire contre un adversaire reconnu compte vraiment, pas seulement sur le papier.
        </p>
        <p>
          Le score tient aussi compte de l&apos;activité (rester actif rapporte), des séries de victoires/défaites, du
          format du combat (titre, 5 rounds), et de l&apos;inactivité prolongée : un combattant qui ne s&apos;est pas
          battu depuis longtemps voit son score redescendre doucement, même s&apos;il n&apos;a jamais perdu.
        </p>
      </Section>

      <Section title="3. Le profil de style">
        <p>
          Chaque combattant est classé dans un profil de style (frappeur de distance, wrestler/contrôleur, pressure
          fighter, finisseur soumission) déterminé automatiquement à partir de ses statistiques — d&apos;où il frappe,
          combien il tente de takedowns, combien de temps il passe en contrôle. C&apos;est calculé par un algorithme
          de classification (clustering), pas assigné à la main.
        </p>
      </Section>

      <Section title="Pourquoi le champion a parfois une astérisque">
        <p>
          Le champion en titre est toujours affiché en première position de sa catégorie, quel que soit son score —
          la ceinture est un fait sportif, pas juste un résultat de calcul. Mais quand son score n&apos;est en réalité{' '}
          <strong className="text-ink-primary">pas</strong> le plus élevé de la catégorie, une astérisque{' '}
          <sup>*</sup> apparaît à côté de son nom : ça veut dire qu&apos;un autre combattant a, statistiquement, un
          parcours plus dominant en ce moment — sans que ça change qui porte la ceinture.
        </p>
      </Section>

      <Section title="Ce qui n'est pas encore pris en compte">
        <p>
          Les organisations autres que l&apos;UFC (pas encore assez de données détaillées disponibles), les bonus
          Performance/Fight of the Night, les pénalités de poids manqué, et la distinction entre décision unanime,
          partagée ou majoritaire.
        </p>
      </Section>
    </main>
  );
}
