// data/lib/legal.ts
// Single source for what the legal pages (mentions légales, confidentialité)
// say about who runs the site and who processes data on its behalf.

// Public contact address for legal notices, takedown requests and RGPD
// requests. Set NEXT_PUBLIC_CONTACT_EMAIL in the Vercel project settings.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;

export const LEGAL_LAST_UPDATED = '12 octobre 2026';

export const HOST = {
  name: 'Vercel Inc.',
  address: '440 N Barranca Ave #4133, Covina, CA 91723, États-Unis',
  website: 'https://vercel.com',
};

export const PROCESSORS = [
  {
    name: 'Clerk Inc.',
    country: 'États-Unis',
    role: 'Création de compte et connexion (adresse e-mail, nom d’utilisateur, mot de passe chiffré ou connexion via un fournisseur tiers).',
    privacyUrl: 'https://clerk.com/legal/privacy',
  },
  {
    name: 'Vercel Inc.',
    country: 'États-Unis',
    role: 'Hébergement du site et mesure d’audience anonyme (Vercel Web Analytics, sans cookie).',
    privacyUrl: 'https://vercel.com/legal/privacy-policy',
  },
  {
    name: 'Neon Inc.',
    country: 'États-Unis (serveurs selon la région du projet)',
    role: 'Base de données : identifiant de compte, pseudo, pronostics et préférences.',
    privacyUrl: 'https://neon.tech/privacy-policy',
  },
];
