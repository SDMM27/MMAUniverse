/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
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
        ink: {
          primary: '#f5f5f5',
          secondary: '#9a9a9a',
        },
      },
    },
  },
  plugins: [],
};
