/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#B1D4D0',
          dark: '#91b8b4',
          hover: '#c4e2de',
          soft: 'rgba(177, 212, 208, 0.12)',
        },
        ink: {
          DEFAULT: '#52352D',
          900: '#2b1a16',
          850: '#2f1d19',
          800: '#3d2621',
          700: '#4a2f28',
          600: '#6b473d',
          500: '#8a6154',
        },
        caution: {
          DEFAULT: '#f0b429',
          soft: 'rgba(240, 180, 41, 0.12)',
        },
        danger: {
          DEFAULT: '#f87171',
          soft: 'rgba(248, 113, 113, 0.12)',
        },
        success: {
          DEFAULT: '#7ed3a6',
          soft: 'rgba(126, 211, 166, 0.12)',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        xl: '0.85rem',
        '2xl': '1.15rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.25), 0 8px 24px -12px rgba(0,0,0,0.45)',
        lift: '0 10px 30px -12px rgba(0,0,0,0.55)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { opacity: '0.45' },
          '50%': { opacity: '0.85' },
          '100%': { opacity: '0.45' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.22s ease-out',
        shimmer: 'shimmer 1.4s ease-in-out infinite',
      },
      screens: {
        xs: '360px',
      },
    },
  },
  plugins: [],
};
