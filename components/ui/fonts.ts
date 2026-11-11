import { Bricolage_Grotesque, Inter, JetBrains_Mono } from 'next/font/google';

// Self-hosted through next/font (no layout shift, no third-party request) and
// exposed as CSS variables that globals.css feeds into the design system's
// --sd-font-* tokens. Bricolage keeps its wdth axis: the "mma" theme sets
// titles at wdth 75 (condensed), see @sdmm/design.
export const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['wdth', 'opsz'],
  variable: '--font-bricolage',
  display: 'swap',
});

export const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});
