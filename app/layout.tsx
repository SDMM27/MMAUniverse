import type { Metadata } from "next";
import { inter, oswald } from "@/components/ui/fonts";
import Nav from "@/components/ui/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "MMA Universe",
  description: "Organisations, events, fights et combattants MMA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${inter.className} ${oswald.variable} bg-base-bg text-ink-primary`}>
        <Nav />
        {children}
      </body>
    </html>
  );
}
