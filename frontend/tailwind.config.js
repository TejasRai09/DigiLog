/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
