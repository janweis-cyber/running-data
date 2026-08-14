/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#E9E9E5',
        surface: '#F7F7F4',
        card: '#FFFFFF',
        hairline: '#E5E5E0',
        inset: '#F1F1ED',
        ink: '#141412',
        sub: '#6E6E67',
        faint: '#A6A69E',
        accent: '#0B5FCC',
        warn: '#C2452D',
      },
      borderRadius: {
        card: '16px',
        btn: '12px',
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto',
          'Helvetica Neue', 'Arial', 'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
