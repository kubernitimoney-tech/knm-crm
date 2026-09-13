import type { Config } from 'tailwindcss';

/**
 * Kuberniti Money brand tokens.
 * Primary palette is also defined in src/styles/index.css @theme block.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary-deep': '#2A2D4F',
        'secondary-dark': '#424665',
        'mid-shade': '#646884',
        'light-gray': '#8D8FA4',
        'lighter-gray': '#B0B0C1',
        'bg-app': '#F4F6F9',
        success: '#10B981',
        danger: '#EF4444',
        warning: '#F59E0B',
        'accent-indigo': '#4F46E5',
        'accent-teal': '#0F766E',
        'card-border': '#E2E8F0',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
};

export default config;
