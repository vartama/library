// Tailwind theme tokens. Only `module.exports` became `export default`
// because this Vite project is an ES module. Do not add colors or sizes here.
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        raised: 'var(--surface-raised)',
        sunken: 'var(--surface-sunken)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        ink: 'var(--ink)',
        muted: 'var(--ink-muted)',
        brand: 'var(--brand)',
        'brand-hover': 'var(--brand-hover)',
        'brand-text': 'var(--brand-text)',
        'on-brand': 'var(--on-brand)',
        'brand-soft': 'var(--brand-soft)',
        accent: 'var(--accent)',
        'on-accent': 'var(--on-accent)',
        'accent-soft': 'var(--accent-soft)',
        danger: 'var(--danger)',
        'on-danger': 'var(--on-danger)',
        'danger-soft': 'var(--danger-soft)',
        warn: 'var(--warn)',
        'warn-soft': 'var(--warn-soft)',
        gold: 'var(--gold)',
        focus: 'var(--focus)',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Figtree', 'system-ui', 'sans-serif'],
      },
      borderRadius: { sm: '4px', md: '8px', lg: '14px', pill: '999px' },
      boxShadow: { card: 'var(--shadow-card)', pop: 'var(--shadow-pop)' },
    },
  },
};
