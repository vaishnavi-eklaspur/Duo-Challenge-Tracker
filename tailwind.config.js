/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        bg: '#0a0a0a',
        surface: '#111111',
        'surface-warm': '#111008',
        border: '#1e1e1e',
        'border-muted': '#2a2a2a',
        amber: '#f5a623',
        'amber-dim': 'rgba(245, 166, 35, 0.25)',
        'amber-glow': 'rgba(245, 166, 35, 0.08)',
        'text-primary': '#f0ece4',
        'text-muted': '#6b6660',
        'gap-color': '#1a0a0a',
        'red-dim': '#2a1212',
      },
    },
  },
  plugins: [],
};
