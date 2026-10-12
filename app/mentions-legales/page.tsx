// app/mentions-legales/page.tsx
import Link from 'next/link';
import type { Metadata } from 'next';
import { ContactLine, LegalPage, LegalSection } from '@/components/ui/legal-page';
import { HOST } from '@/data/lib/legal';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Éditeur, hébergeur, sources des données et propriété intellectuelle de MMA Universe.',
};

export default function Page() {
  return (
    <LegalPage title="Mentions légales">
      <LegalSection title="Éditeur">
        <p>
          MMA Universe est un site non professionnel, édité à titre personnel et non commercial. Conformément à
          l’article 6, III, 2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique (LCEN),
          l’éditeur a choisi de préserver son anonymat ; ses éléments d’identification ont été communiqués à
          l’hébergeur.
        </p>
        <p>
          Contact (directeur de la publication, signalements, demandes de retrait) : <ContactLine />.
        </p>
      </LegalSection>

      <LegalSection title="Hébergeur">
        <p>
          {HOST.name}, {HOST.address} —{' '}
          <a href={HOST.website} className="text-accent underline-offset-2 hover:underline" rel="noopener noreferrer">
            {HOST.website.replace('https://', '')}
          </a>
        </p>
      </LegalSection>

      <LegalSection title="Indépendance">
        <p>
          MMA Universe est un site de fan indépendant. Il n’est ni affilié, ni approuvé, ni sponsorisé par l’UFC, la
          PFL, Bellator, ONE Championship, Cage Warriors, Rizin, KSW, ACA, Invicta FC, LFA, Hexagone MMA, ARES, Oktagon,
          Sherdog, ESPN, UFCStats ou toute autre organisation citée. Les noms d’organisations et d’événements sont des marques de leurs titulaires respectifs
          et ne sont utilisés que pour désigner les événements dont il est question.
        </p>
      </LegalSection>

      <LegalSection title="Sources des données">
        <p>
          Les résultats, cards et fiches des combattants sont des informations factuelles compilées à partir de sources
          publiques, notamment Sherdog, UFCStats.com et les sites officiels des organisations. Les actualités sont
          présentées sous forme de titre et de court extrait, avec un lien vers l’article d’origine, qui reste la
          propriété de son éditeur.
        </p>
        <p>
          Le FightScore, les classements calculés, les analyses et les probabilités du simulateur sont produits par MMA
          Universe à partir de ces données. Ce sont des estimations statistiques fournies à titre informatif : elles ne
          constituent ni un conseil ni une incitation à parier.
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle et retrait de contenu">
        <p>
          Les photos de combattants et les visuels d’articles appartiennent à leurs auteurs et ayants droit. Si vous
          êtes titulaire de droits sur un contenu affiché ici et souhaitez son retrait ou la correction d’une
          information, écrivez <ContactLine /> en précisant la page concernée : la demande sera traitée dans les plus
          brefs délais.
        </p>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <p>
          Le traitement des données des utilisateurs est décrit dans la{' '}
          <Link href="/confidentialite" className="text-accent underline-offset-2 hover:underline">
            politique de confidentialité
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
