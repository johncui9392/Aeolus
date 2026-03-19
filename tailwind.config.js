/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        'bg-dark': '#0a0a12',
        'text-main': '#e2e8f0',
        accent: {
          blue: '#818cf8',
          cyan: '#22d3ee',
          red: '#f43f5e',
          glow: 'rgba(129, 140, 248, 0.2)',
        },
      },
    },
  },
  plugins: [],
}
