import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { inter, oswald } from "@/components/ui/fonts";
import Nav from "@/components/ui/nav";
import "./globals.css";
import "flag-icons/css/flag-icons.min.css";

export const metadata: Metadata = {
  title: "MMA Universe",
  description: "Organisations, events, fights et combattants MMA",
  applicationName: "MMA Universe",
  openGraph: {
    siteName: "MMA Universe",
    title: "MMA Universe",
    description: "Organisations, events, fights et combattants MMA",
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
        </body>
      </html>
    </ClerkProvider>
  );
}
