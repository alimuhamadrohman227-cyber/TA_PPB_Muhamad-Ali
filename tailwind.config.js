/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
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
