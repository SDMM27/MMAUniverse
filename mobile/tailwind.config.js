/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // App is always dark (Dark Combat theme, no light mode) — 'class' strategy avoids
  // NativeWind's "Cannot manually set color scheme" throw that the 'media' default
  // triggers on web when app.json's userInterfaceStyle isn't "automatic".
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: {
          bg: '#0a0a0a',
          card: '#161616',
          border: '#262626',
        },
        accent: {
          DEFAULT: '#ff3b30',
        },
        win: {
          DEFAULT: '#3fb950',
        },
        ink: {
          primary: '#f5f5f5',
          secondary: '#9a9a9a',
        },
      },
      fontFamily: {
        display: ['Oswald_700Bold'],
      },
    },
  },
  plugins: [],
};
