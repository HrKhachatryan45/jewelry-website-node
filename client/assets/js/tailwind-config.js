// Shared Tailwind Play-CDN config (mirrors templates/base.html).
tailwind.config = {
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        luxe: {
          gold: '#D4AF37',
          charcoal: '#1F2937',
          slate: '#6B7280',
          black: '#111827',
        },
        star: 'hsl(var(--star-gold))',
      },
      fontFamily: {
        heading: ['Cormorant Garamond', 'serif'],
        body: ['Montserrat', 'sans-serif'],
      },
      borderRadius: { lg: '0px', md: '0px', sm: '0px' },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in-left': { '0%': { opacity: '0', transform: 'translateX(-30px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        'fade-in-right': { '0%': { opacity: '0', transform: 'translateX(30px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        'scale-in': { '0%': { transform: 'scale(0.98)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        'slide-up': { '0%': { transform: 'translateY(100%)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        'ken-burns': { '0%': { transform: 'scale(1)' }, '100%': { transform: 'scale(1.05)' } },
        'pulse-soft': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.8' } },
      },
      animation: {
        'fade-in': 'fade-in 1s ease-out forwards',
        'fade-in-left': 'fade-in-left 1s ease-out forwards',
        'fade-in-right': 'fade-in-right 1s ease-out forwards',
        'scale-in': 'scale-in 0.8s ease-out forwards',
        'slide-up': 'slide-up 1s ease-out forwards',
        float: 'float 8s ease-in-out infinite',
        'ken-burns': 'ken-burns 30s ease-in-out infinite alternate',
        'pulse-soft': 'pulse-soft 4s ease-in-out infinite',
      },
    },
  },
};
