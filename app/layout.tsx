import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { inter, oswald } from "@/components/ui/fonts";
import Nav from "@/components/ui/nav";
import { getSiteUrl } from "@/data/lib/site-url";
import { OPEN_GRAPH_BASE, SITE_NAME } from "@/data/lib/seo-utils";
import "./globals.css";
import "flag-icons/css/flag-icons.min.css";

const SITE_DESCRIPTION =
  "Tout le MMA au même endroit : événements et cards, résultats, classements officiels, FightScore, fiches de combattants et pronostics.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // No title/description here: Next fills them in from each page's own, where a
  // fixed value would give every page the same share title.
  openGraph: { ...OPEN_GRAPH_BASE, type: "website" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  formatDetection: { telephone: false },
  // Search Console ownership check, set in the deployment's environment.
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="fr">
        <body className={`${inter.className} ${oswald.variable} bg-base-bg text-ink-primary`}>
          <Nav />
          {children}
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
