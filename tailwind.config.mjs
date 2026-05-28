import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  // Safelist — classes geradas dinamicamente via `bg-cat-${c}` interpolation
  // que JIT não detecta no scan. Aqui forçamos a inclusão no build.
  safelist: [
    'bg-cat-terracota',
    'bg-cat-azul-tinta',
    'bg-cat-oliva',
    'bg-cat-ocre',
    'bg-cat-vinho',
    'text-cat-terracota',
    'text-cat-azul-tinta',
    'text-cat-oliva',
    'text-cat-ocre',
    'text-cat-vinho',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        'primary-soft': 'rgb(var(--c-primary-soft) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        'ink-muted': 'rgb(var(--c-ink-muted) / <alpha-value>)',
        'ink-faint': 'rgb(var(--c-ink-faint) / <alpha-value>)',
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        elev: 'rgb(var(--c-elev) / <alpha-value>)',
        border: 'rgb(var(--c-border) / <alpha-value>)',
        rule: 'rgb(var(--c-rule) / <alpha-value>)',
        cat: {
          terracota: 'rgb(var(--cat-terracota) / <alpha-value>)',
          'azul-tinta': 'rgb(var(--cat-azul-tinta) / <alpha-value>)',
          oliva: 'rgb(var(--cat-oliva) / <alpha-value>)',
          ocre: 'rgb(var(--cat-ocre) / <alpha-value>)',
          vinho: 'rgb(var(--cat-vinho) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'xs':   ['0.75rem',   { lineHeight: '1.5' }],
        'sm':   ['0.875rem',  { lineHeight: '1.55' }],
        'base': ['1rem',      { lineHeight: '1.65' }],
        'lg':   ['1.125rem',  { lineHeight: '1.55' }],
        'xl':   ['1.375rem',  { lineHeight: '1.35' }],
        '2xl':  ['1.75rem',   { lineHeight: '1.2' }],
        '3xl':  ['2.25rem',   { lineHeight: '1.1' }],
        '4xl':  ['3rem',      { lineHeight: '1.05' }],
        '5xl':  ['3.75rem',   { lineHeight: '1' }],
        '6xl':  ['4.5rem',    { lineHeight: '0.98' }],
        '7xl':  ['6rem',      { lineHeight: '0.95' }],
        '8xl':  ['8rem',      { lineHeight: '0.92' }],
      },
      spacing: {
        'gutter': '1.5rem',
        'gutter-lg': '2.5rem',
      },
      maxWidth: {
        'container': '1280px',
        'prose-lg': '68ch',
      },
      borderRadius: {
        DEFAULT: '8px',
        'md': '12px',
        'lg': '16px',
      },
    },
  },
  plugins: [
    typography,
  ],
}
