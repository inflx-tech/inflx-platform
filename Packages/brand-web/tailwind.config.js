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
        // Wave 2 (Dining redesign) tokens. Scoped names so they don't collide
        // with the existing dashboard palette — used by the listing wizard
        // chrome + BookingsInbox.
        yellow:  { DEFAULT: '#EAB308', deep: '#CA8A04', light: '#FACC15', pale: '#FEF9C3' },
        ink:     { 1: '#1F2328', 2: '#57606A', 3: '#8C959F' },
        paper:   { DEFAULT: '#FFFFFF', surface: '#F8F9FA', deep: '#DEE2E6' },
        line:    { soft: '#D0D7DE', firm: '#AFB8C1' },
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
