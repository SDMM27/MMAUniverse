import type { Config } from "tailwindcss";
import sdPreset from "@sdmm/design/tailwind/preset";

// Colors read the design system's --sd-* variables, so every class follows
// the dark/light theme. <alpha-value> keeps opacity modifiers (border-line/60).
const v = (name: string) => `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

const config: Config = {
  // @sdmm/design: colors (bg, surface, surface-2, ink, muted, line, accent,
  // accent-strong, accent-ink, accent-2, live, wip, danger), font-display
  // (Bricolage condensed), dark: variant driven by data-theme.
  presets: [sdPreset as unknown as Partial<Config>],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy names from the pre-redesign palette, kept as aliases of the
        // design system tokens so older markup themes correctly too.
        base: { bg: v("sd-bg"), card: v("sd-surface"), border: v("sd-line") },
        ink: { DEFAULT: v("sd-ink"), primary: v("sd-ink"), secondary: v("sd-muted") },
        win: {
          DEFAULT: v("sd-live"),
          // Small green text (results, trends): AA on bg/surface in both themes.
          strong: v("mu-win-strong"),
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
