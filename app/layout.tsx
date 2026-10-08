import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { inter, oswald } from "@/components/ui/fonts";
import Nav from "@/components/ui/nav";
import { getSiteUrl } from "@/data/lib/site-url";
import "./globals.css";
import "flag-icons/css/flag-icons.min.css";

const SITE_DESCRIPTION =
  "Tout le MMA au même endroit : événements et cards, résultats, classements officiels, FightScore, fiches de combattants et pronostics.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: "MMA Universe", template: "%s · MMA Universe" },
  description: SITE_DESCRIPTION,
  applicationName: "MMA Universe",
  openGraph: {
    siteName: "MMA Universe",
    title: "MMA Universe",
    description: SITE_DESCRIPTION,
    locale: "fr_FR",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
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
