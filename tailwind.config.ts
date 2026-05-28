import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        amber: {
          DEFAULT: '#EF9F27',
          light: '#FAC775',
          dark: '#BA7517',
        },
        bg: {
          DEFAULT: '#1A1714',
          surface: '#2A2520',
          border: '#3A3530',
        },
        text: {
          primary: '#F5F0E8',
          muted: '#888580',
        },
        success: '#3DBF7F',
        danger: '#E85D5D',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '20px',
        full: '999px',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
