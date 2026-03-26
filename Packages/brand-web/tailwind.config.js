/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#1B2D5E', deep: '#111E42', mid: '#243672', light: '#2E4494', pale: '#EEF1FB' },
        orange: { DEFAULT: '#F47920', deep: '#D4601A', pale: '#FEF0E4' },
        gold: { DEFAULT: '#FFB800', deep: '#E0A000', pale: '#FFF8E1' },
        teal: { DEFAULT: '#00B894', deep: '#007A63', pale: '#E0FAF5' },
        red: { DEFAULT: '#E8401A', pale: '#FDEEE9' },
        purple: { DEFAULT: '#7F77DD', pale: '#EEEDFE' },
        bg: '#F4F6FB',
        surface: '#FFFFFF',
        surface2: '#F2F4F9',
        border: '#E0E4EF',
        border2: '#C8CEDF',
        t1: '#0D1630',
        t2: '#4A5278',
        t3: '#8B91AD',
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Plus Jakarta Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
