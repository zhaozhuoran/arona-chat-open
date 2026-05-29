import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ba: {
          primary: '#003153',
          primary2: '#2265bb',
          accent: '#77deff',
          accent2: '#1289f9',
          warning: '#ffe433',
          bg: '#ffffff',
          surface: '#f0f0f0',
          glass: 'rgba(232, 243, 238, 0.9)'
        }
      },
      animation: {
        'ba-float': 'float 2s ease-in-out infinite',
        'ba-enter': 'panel-enter 300ms ease-out'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'panel-enter': {
          '0%': { opacity: 0, transform: 'translateY(10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        }
      }
    }
  },
  plugins: [
    typography,
  ],
}
