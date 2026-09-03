/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'staging-marquee': {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'staging-marquee': 'staging-marquee 28s linear infinite',
      },
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        sugar: '#10b981',
        power: '#f59e0b',
        ethanol: '#06b6d4',
      },
      boxShadow: {
        soft: '0 20px 40px -15px rgba(0,0,0,0.05)',
        bento: '0 4px 20px -2px rgba(0,0,0,0.03)',
      },
    },
  },
  plugins: [],
};
