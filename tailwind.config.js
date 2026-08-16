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
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', '"SF Pro"', 'system-ui', 'sans-serif'],
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
        'light-bg': '#FAFAFA',
        'light-card': 'rgba(255, 255, 255, 0.6)',
        'light-text': '#2D2D2D',
        'light-text-secondary': '#404040',
        'light-separator': 'rgba(229, 229, 229, 0.5)',
        'light-fill': 'rgba(250, 250, 250, 0.5)',

        'dark-bg': '#050505',
        'dark-card': 'rgba(23, 23, 23, 0.6)',
        'dark-text': '#FFFFFF',
        'dark-text-secondary': '#D1D5DB',
        'dark-separator': 'rgba(255, 255, 255, 0.05)',
        'dark-fill': 'rgba(38, 38, 38, 0.4)',

        'semantic-red': '#FF3B30',
        'semantic-green': '#34C759',
        'semantic-yellow': '#FFCC00',
        'semantic-blue': '#007AFF',
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'modal': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'neu-raised-light': '2px 2px 4px rgba(0,0,0,0.1), -2px -2px 4px rgba(255,255,255,0.8)',
        'neu-inset-light': 'inset 2px 2px 4px rgba(0,0,0,0.05), inset -2px -2px 4px rgba(255,255,255,0.5)',
        'neu-raised-dark': '2px 2px 4px rgba(0,0,0,0.5), -2px -2px 4px rgba(255,255,255,0.05)',
        'neu-inset-dark': 'inset 2px 2px 4px rgba(0,0,0,0.5), inset -2px -2px 4px rgba(255,255,255,0.05)',
      },
      borderRadius: {
        'xl': '16px',
      },
    },
  },
  plugins: [],
};
