import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sakura: {
          50: '#fff5f7',
          100: '#ffe4ec',
          200: '#fbcfdc',
          300: '#f7a8c0',
          400: '#f178a1',
          500: '#e94e85',
          600: '#d23568',
          700: '#a82751',
          800: '#7d1d3c',
          900: '#54142a',
        },
        cream: '#fdfaf6',
        soft: '#f5f0eb',
      },
      fontFamily: {
        sans: ['"Pretendard"', '"Noto Sans KR"', 'system-ui', 'sans-serif'],
        display: ['"Gowun Batang"', '"Pretendard"', 'serif'],
      },
      boxShadow: {
        soft: '0 6px 20px -8px rgba(233, 78, 133, 0.18)',
        card: '0 10px 30px -12px rgba(0, 0, 0, 0.08)',
      },
      keyframes: {
        'fall': {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '0' },
          '20%': { opacity: '1' },
          '100%': { transform: 'translateY(110vh) rotate(360deg)', opacity: '0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fall': 'fall linear infinite',
        'fade-up': 'fade-up 0.4s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
