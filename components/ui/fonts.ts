import { Inter, Oswald } from 'next/font/google';

export const inter = Inter({ subsets: ['latin'] });

export const oswald = Oswald({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-oswald',
});
