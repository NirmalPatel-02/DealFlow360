/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#212529',
        sub: '#434343',
        muted: '#6C757D',
      },
      fontFamily: {
        heading: ['"Bricolage Grotesque"', 'Arial', 'sans-serif'],
        subheading: ['Manrope', 'Inter', 'Arial', 'sans-serif'],
        body: ['Arial', 'Helvetica', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
