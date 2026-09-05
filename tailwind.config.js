/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--app-font-family)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        serif: ['var(--app-font-family)', 'Georgia', 'serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem', letterSpacing: '0.01em' }],
      },
      colors: {
        primary: {
          50: 'var(--primary-50, #fef8f0)',
          100: 'var(--primary-100, #fdeed9)',
          200: 'var(--primary-200, #fbddb1)',
          300: 'var(--primary-300, #faca89)',
          400: 'var(--primary-400, #fcb045)',
          500: 'var(--primary-500, #fa9a1d)',
          600: 'var(--primary-600, #e78310)',
          700: 'var(--primary-700, #c1670e)',
          800: 'var(--primary-800, #995111)',
          900: 'var(--primary-900, #7d4312)',
        },
        'light-bg': '#f8fafc',
        'light-card': 'rgba(255, 255, 255, 0.6)',
        'light-text': '#0f172a',
        'light-text-secondary': '#475569',
        'light-separator': 'rgba(226, 232, 240, 0.8)',
        'light-fill': 'rgba(241, 245, 249, 0.8)',

        'dark-bg': '#020617',
        'dark-card': 'rgba(0, 0, 0, 0.2)',
        'dark-text': '#f8fafc',
        'dark-text-secondary': '#94a3b8',
        'dark-separator': 'rgba(255, 255, 255, 0.05)',
        'dark-fill': 'rgba(255, 255, 255, 0.04)',

        'semantic-red': '#EF4444',
        'semantic-green': '#10B981',
        'semantic-yellow': '#F59E0B',
        'semantic-blue': '#06B6D4',
      },
      boxShadow: {
        'card': '4px 6px 12px rgba(0, 0, 0, 0.06)',
        'card-dark': '4px 6px 12px rgba(0, 0, 0, 0.25)',
        'modal': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'neu-raised-light': '2px 2px 4px rgba(0,0,0,0.1), -2px -2px 4px rgba(255,255,255,0.8)',
        'neu-inset-light': 'inset 2px 2px 4px rgba(0,0,0,0.05), inset -2px -2px 4px rgba(255,255,255,0.5)',
        'neu-raised-dark': '2px 2px 4px rgba(0,0,0,0.5), -2px -2px 4px rgba(255,255,255,0.05)',
        'neu-inset-dark': 'inset 2px 2px 4px rgba(0,0,0,0.5), inset -2px -2px 4px rgba(255,255,255,0.05)',
      },
      borderRadius: {
        'xl': '16px',
      },
      zIndex: {
        'dropdown': '50',
        'sticky': '100',
        'popover': '200',
        'modal': '500',
        'toast': '1000',
        'max': '9999',
      },
    },
  },
  plugins: [],
};
