// app/confidentialite/page.tsx
import Link from 'next/link';
import type { Metadata } from 'next';
import { ContactLine, LegalPage, LegalSection } from '@/components/ui/legal-page';
import { PROCESSORS } from '@/data/lib/legal';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Quelles données MMA Universe collecte, pourquoi, combien de temps, et comment exercer vos droits.',
};

const linkClass = 'text-accent underline-offset-2 hover:underline';

export default function Page() {
  return (
    <LegalPage title="Politique de confidentialité">
      <LegalSection title="En bref">
        <p>
          Le site se consulte sans compte. Seuls les visiteurs qui créent un compte (pour faire des pronostics ou
          enregistrer leurs préférences) transmettent des données personnelles. Aucune donnée n’est vendue, aucune
          publicité ciblée n’est diffusée et aucun cookie publicitaire ou de pistage n’est déposé.
        </p>
      </LegalSection>

      <LegalSection title="Responsable du traitement">
        <p>
          L’éditeur de MMA Universe (voir les{' '}
          <Link href="/mentions-legales" className={linkClass}>
            mentions légales
          </Link>
          ), joignable <ContactLine />.
        </p>
      </LegalSection>

      <LegalSection title="Données collectées et finalités">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="text-ink-primary">Compte</span> : adresse e-mail, nom d’utilisateur ou prénom, et, si vous
            vous connectez via un fournisseur tiers (Google par exemple), l’identifiant transmis par ce fournisseur.
            Finalité : vous identifier et sécuriser votre compte. Base légale : exécution du service que vous demandez
            (art. 6.1.b RGPD).
          </li>
          <li>
            <span className="text-ink-primary">Pronostics et préférences</span> : vos pronostics, combattants favoris et
            nationalités suivies. Finalité : afficher vos pronostics, votre score et un contenu personnalisé. Base
            légale : exécution du service.
          </li>
          <li>
            <span className="text-ink-primary">Mesure d’audience</span> : pages vues, pays, type d’appareil et site
            d’origine, de façon agrégée et sans cookie ni identifiant persistant (Vercel Web Analytics). Finalité :
            savoir quelles pages sont utiles. Base légale : intérêt légitime (art. 6.1.f RGPD).
          </li>
          <li>
            <span className="text-ink-primary">Journaux techniques</span> : adresse IP et requêtes conservées
            brièvement par l’hébergeur pour la sécurité et le bon fonctionnement du site. Base légale : intérêt
            légitime.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Le site n’utilise que des cookies strictement nécessaires : ceux de Clerk, qui maintiennent votre session
          lorsque vous êtes connecté. Ils sont exemptés de consentement (article 82 de la loi Informatique et Libertés).
          La mesure d’audience ne dépose aucun cookie.
        </p>
      </LegalSection>

      <LegalSection title="Destinataires et transferts hors de l’Union européenne">
        <p>Vos données ne sont accessibles qu’à l’éditeur et aux prestataires techniques suivants :</p>
        <ul className="list-disc space-y-2 pl-5">
          {PROCESSORS.map((p) => (
            <li key={p.name}>
              <span className="text-ink-primary">{p.name}</span> ({p.country}) — {p.role}{' '}
              <a href={p.privacyUrl} className={linkClass} rel="noopener noreferrer">
                Sa politique
              </a>
            </li>
          ))}
        </ul>
        <p>
          Ces prestataires étant établis aux États-Unis, les transferts sont encadrés par le Data Privacy Framework
          UE–États-Unis et/ou les clauses contractuelles types de la Commission européenne.
        </p>
      </LegalSection>

      <LegalSection title="Durée de conservation">
        <p>
          Les données de compte, pronostics et préférences sont conservées tant que le compte existe, et supprimées
          dès sa suppression. Un compte inactif depuis trois ans peut être supprimé. Les statistiques d’audience sont
          agrégées et anonymes.
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et de
          portabilité de vos données. Vous pouvez supprimer vous-même votre compte et toutes les données associées
          depuis la page{' '}
          <Link href="/profil" className={linkClass}>
            Mon profil
          </Link>
          . Pour toute autre demande, écrivez <ContactLine />.
        </p>
        <p>
          Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (
          <a href="https://www.cnil.fr" className={linkClass} rel="noopener noreferrer">
            cnil.fr
          </a>
          ).
        </p>
      </LegalSection>
    </LegalPage>
  );
}
