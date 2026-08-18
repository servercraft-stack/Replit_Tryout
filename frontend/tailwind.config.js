/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--surface-1)',
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          4: 'var(--surface-4)',
          5: 'var(--surface-5)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
        },
        cyan: {
          DEFAULT: 'var(--cyan)',
          glow: 'var(--cyan-glow)',
        },
        violet: {
          DEFAULT: 'var(--violet)',
          glow: 'var(--violet-glow)',
        },
        crimson: {
          DEFAULT: 'var(--crimson)',
          glow: 'var(--crimson-glow)',
        },
        border: {
          DEFAULT: 'var(--border-color)',
          hover: 'var(--border-hover)',
          specular: 'var(--border-specular)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'fade-in-down': 'fadeInDown 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'pulse-ring': 'pulseRing 2s ease-in-out infinite',
        'lightfall': 'lightfall 3s ease-in infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '33%': { transform: 'translateY(-8px) rotate(1deg)' },
          '66%': { transform: 'translateY(4px) rotate(-1deg)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px var(--accent-glow), 0 0 10px var(--accent-glow)' },
          '100%': { boxShadow: '0 0 20px var(--accent-glow), 0 0 40px var(--accent-glow)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 var(--accent-glow)' },
          '70%': { transform: 'scale(1)', boxShadow: '0 0 0 8px transparent' },
          '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 transparent' },
        },
        lightfall: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '10%': { opacity: '0.6' },
          '90%': { opacity: '0.6' },
          '100%': { transform: 'translateY(100vh)', opacity: '0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'glow': '0 0 20px -5px var(--accent-glow)',
        'inner-glow': 'inset 0 0 20px -5px var(--accent-glow)',
      },
    },
  },
  plugins: [],
}
