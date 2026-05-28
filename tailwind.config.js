/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
      },
      colors: {
        pulse: {
          purple: '#7C5CFF',
          lilac: '#A78BFA',
          ink: '#0B0B12',
          dark: '#171724',
          card: '#1E1C2E',
        },
        coral: '#FF7A6B',
        mint: '#53D6A1',
        note: '#FFB547',
        sky: '#DDEBFF',
      },
      backgroundImage: {
        'gradient-pulse': 'linear-gradient(135deg, #7C5CFF 0%, #A78BFA 100%)',
        'gradient-coral': 'linear-gradient(135deg, #FF7A6B 0%, #FFB547 100%)',
        'gradient-mint': 'linear-gradient(135deg, #53D6A1 0%, #3BB88A 100%)',
        'gradient-radial': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(124,92,255,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(124,92,255,0.6)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'orb-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.6' },
          '50%': { transform: 'scale(1.1)', opacity: '0.8' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out forwards',
        float: 'float 5s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        'orb-pulse': 'orb-pulse 6s ease-in-out infinite',
      },
      boxShadow: {
        glow: '0 0 30px rgba(124, 92, 255, 0.4)',
        'glow-sm': '0 0 16px rgba(124, 92, 255, 0.3)',
        'glow-coral': '0 0 20px rgba(255, 122, 107, 0.3)',
        'glow-mint': '0 0 20px rgba(83, 214, 161, 0.3)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glass-lg': '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
      },
    },
  },
  plugins: [],
}
