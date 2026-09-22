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

      <Section title="2. Une note unique pour toute la carrière">
        <p>
          Chaque combattant a une seule note, qui le suit dans toutes les catégories où il combat. Changer de
          catégorie ne remet pas les compteurs à zéro : un champion qui monte d&apos;une catégorie garde sa
          réputation, avec simplement un peu plus d&apos;incertitude le temps de confirmer à son nouveau poids.
        </p>
        <p>
          Après chaque combat, la note du vainqueur monte et celle du perdant descend, d&apos;autant plus que le
          résultat était inattendu : battre un adversaire très bien noté (un champion, un membre du top 5) rapporte
          beaucoup, battre un débutant presque rien. Enchaîner les combats ne suffit donc pas à grimper : seule la
          qualité des adversaires battus compte. Plus la victoire est dominante, plus elle rapporte.
        </p>
        <p>
          Chaque note est accompagnée d&apos;une marge d&apos;incertitude. Elle est grande pour un nouveau venu, se
          resserre à chaque combat, et s&apos;élargit à nouveau avec l&apos;inactivité ou un changement de catégorie.
          Le classement utilise une note prudente, la note moins deux fois cette marge : ce que l&apos;on peut affirmer
          avec une bonne confiance. Quelques victoires éclatantes ne suffisent pas à dépasser un combattant qui a fait
          ses preuves pendant des années, et une longue absence fait reculer au classement sans rien effacer du
          parcours. Un no contest compte comme une activité.
        </p>
        <p>
          Le score de 0 à 100 se lit ainsi : c&apos;est deux fois la chance estimée de battre le n°1 de la catégorie.
          Le n°1 vaut donc 100, et un combattant qui aurait environ une chance sur quatre de le battre vaut près de 50.
        </p>
        <p>
          Le classement ne montre que les combattants actifs dans leur catégorie actuelle : sans combat dans la
          catégorie depuis plus de 18 mois, ou après être passé dans une autre catégorie, un combattant sort de la
          liste (son score reste visible sur sa fiche). Le champion en titre garde toujours sa place.
        </p>
        <p>
          Les réglages (vitesse à laquelle l&apos;incertitude grandit, part de la note conservée au changement de
          catégorie, poids de la dominance) ont été vérifiés sur l&apos;historique UFC : réglés sur les combats
          antérieurs à mars 2023, puis testés sur les 1 468 combats suivants, jamais vus pendant le réglage. Cette
          note prédit le vainqueur au moins aussi bien que l&apos;ancien système, qui repartait de zéro à chaque
          changement de catégorie. Le classement est aussi soumis à une série de contrôles de cohérence (par exemple :
          aucun n°1 de catégorie avec une poignée de combats et aucune victoire contre le top 10), sans qu&apos;aucun
          nom ne soit jamais imposé au calcul.
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

      <Section title="4. La probabilité de victoire (modèle entraîné)">
        <p>
          En complément du score, chaque fiche affiche une probabilité de victoire estimée face à un adversaire moyen
          de la catégorie. Elle vient d&apos;un modèle statistique (une régression logistique) entraîné sur l&apos;historique
          des combats UFC : il apprend, combat après combat, quels signaux annoncent le mieux un vainqueur.
        </p>
        <p>
          Il s&apos;appuie sur un score de carrière calculé par catégorie, la série en cours, le statut d&apos;ancien champion, le temps écoulé depuis le
          dernier combat, la dominance moyenne des 3 derniers combats et le style de combat sur les 5 derniers
          (frappes par zone, takedowns, contrôle, soumissions). Le signal le plus utile s&apos;est révélé être la forme
          récente, à égalité avec ce score de carrière.
        </p>
        <p className="rounded-lg border border-base-border bg-base-card p-3 text-xs">
          <strong className="text-ink-primary">À prendre avec recul :</strong> sur les 1 468 combats les plus récents,
          jamais vus à l&apos;entraînement, ce modèle désigne le vainqueur dans environ 58 % des cas (50 % au hasard,
          57 % avec le seul score de carrière). C&apos;est un signal utile, mais un léger complément du score plutôt qu&apos;une
          prédiction fiable : un combat reste très incertain.
        </p>
      </Section>

      <Section title="5. Le pound-for-pound">
        <p>
          Comme la note est la même dans toutes les catégories, elle permet de comparer directement un poids mouche
          et un poids lourd : le classement pound-for-pound trie tous les combattants actifs sur cette échelle
          commune (hommes et femmes séparément). Le n°1 pound-for-pound vaut 100, les autres sont notés par rapport
          à lui, avec la même lecture que dans les catégories.
        </p>
      </Section>

      <Section title="Le champion est toujours n°1 de sa catégorie">
        <p>
          Dans chaque catégorie, le champion en titre est affiché en première position avec un score de 100 — la
          ceinture est un fait sportif, pas juste un résultat de calcul. Les autres combattants gardent l&apos;ordre
          de leur note, avec un score plafonné juste en dessous (99,9). Un challenger peut donc avoir, sur le papier,
          une note plus élevée que le champion : c&apos;est dans l&apos;octogone que ça se règle.
        </p>
        <p>
          Cette règle ne s&apos;applique pas au pound-for-pound : là, chaque champion est classé selon sa note réelle.
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
