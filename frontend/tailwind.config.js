/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        kimi: {
          bg: '#141414',
          sidebar: '#141414',
          surface: '#1b1b1b',
          surfaceHover: '#262626',
          card: '#1e1e1e',
          cardHover: '#232323',
          border: '#2e2e2e',
          borderSubtle: '#262626',
          dock: '#1e1e1e',
          dockBorder: '#2e2e2e',
          pill: '#1e1e1e',
          pillBorder: '#2c2c2c',
          pillHover: '#2a2a2a',
          text: '#ffffff',
          muted: '#8e8e8e',
          dim: '#616161',
          accent: '#ffffff',
          accentBlue: '#2b5cff',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        heading: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        'dock': '0 12px 36px rgba(0, 0, 0, 0.65)',
        'dropdown': '0 8px 24px rgba(0, 0, 0, 0.55)',
        'modal': '0 20px 50px rgba(0, 0, 0, 0.75)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-up': 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
    },
  },
  plugins: [],
}
