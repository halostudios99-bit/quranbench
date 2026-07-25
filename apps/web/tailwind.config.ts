import type { Config } from 'tailwindcss';

// Every colour resolves to a CSS custom property (see src/styles/globals.css),
// so a component never names a hex value and light/dark switch with one attribute.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        soft: 'var(--soft)',
        line: 'var(--line)',
        line2: 'var(--line2)',
        ink: 'var(--ink)',
        ink2: 'var(--ink2)',
        ink3: 'var(--ink3)',
        accent: 'var(--accent)',
        'accent-bg': 'var(--accent-bg)',
        'accent-line': 'var(--accent-line)',
        'on-accent': 'var(--on-accent)',
      },
      fontFamily: {
        ui: 'var(--font-ui)',
        arabic: 'var(--font-arabic-ui)',
        quran: 'var(--font-quran)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
      },
      maxWidth: {
        reader: '46rem',
        wrap: '69rem',
      },
    },
  },
  plugins: [],
};

export default config;
