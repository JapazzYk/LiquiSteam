/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // As cores seguem o tema ativo (variáveis em src/index.css).
      // "white" é a cor do texto do tema; em temas claros ela fica escura.
      colors: {
        white: 'rgb(var(--ink) / <alpha-value>)',
        black: 'rgb(var(--shade) / <alpha-value>)',
        snow: '#ffffff',
        canvas: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        ok: 'rgb(var(--ok) / <alpha-value>)',
        bad: 'rgb(var(--bad) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
