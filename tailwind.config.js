/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontSize: {
        eyebrow: ['11.5px', { lineHeight: '1.4', letterSpacing: '0.12em', fontWeight: '600' }],
        'page-title': ['28px', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        'section-title': ['20px', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '700' }],
        'card-title': ['15px', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.5' }],
        caption: ['12px', { lineHeight: '1.4', fontWeight: '500' }],
        'hero-number': ['40px', { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '700' }],
      },
      spacing: {
        page: '20px',
        section: '28px',
        card: '20px',
        item: '12px',
      },
      colors: {
        canvas: '#F7F7F5',
        forest: '#24332C',
        ink: '#1E2421',
        line: '#EFEFED',
      },
      boxShadow: {
        card: '0 8px 30px rgba(32, 45, 38, 0.045)',
      },
    },
  },
  plugins: [],
};
