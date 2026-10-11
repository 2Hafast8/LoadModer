/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/desktop/renderer/index.html",
    "./src/desktop/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          bg: '#090D0B',
          surface: '#121815',
          card: '#151D19',
          border: '#1E2822',
          subtle: '#18221B',
          hover: '#1A241F',
        },
        emerald: {
          primary: '#10B981',
          active: '#22C55E',
          muted: '#059669',
          dark: '#064E3B',
          tint: 'rgba(16, 185, 129, 0.12)',
        },
        nordic: {
          text: '#F3F4F6',
          muted: '#829289',
          faint: '#4E5C55',
        },
        status: {
          danger: '#EF4444',
          warning: '#F59E0B',
          info: '#38BDF8',
          success: '#22C55E',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
