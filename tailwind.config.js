/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{vue,html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif']
      },
      colors: {
        surface: {
          DEFAULT: '#0f1419',
          card: '#1a2332',
          border: '#2d3a4d'
        },
        accent: {
          DEFAULT: '#3b82f6',
          muted: '#60a5fa'
        }
      }
    }
  },
  plugins: []
}
