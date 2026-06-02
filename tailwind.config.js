/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'primary-light': 'var(--primary-light)',
        'primary-pale': 'var(--primary-pale)',
        gold: 'var(--gold)',
        'gold-pale': 'var(--gold-pale)',
        green: 'var(--green)',
        'green-light': 'var(--green-light)',
        dark: 'var(--dark)',
        dark2: 'var(--dark2)',
        gray1: 'var(--gray1)',
        gray2: 'var(--gray2)',
        gray3: 'var(--gray3)',
        gray4: 'var(--gray4)',
        text: 'var(--text)',
        white: 'var(--white)',
        blue: 'var(--blue)',
        'blue-pale': 'var(--blue-pale)',
        red: 'var(--red)',
        'red-pale': 'var(--red-pale)',
        purple: 'var(--purple)',
        'purple-pale': 'var(--purple-pale)',
      },
      fontFamily: {
        sans: ['var(--ff)', 'sans-serif'],
        display: ['var(--ff-display)', 'serif'],
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      borderRadius: {
        brand: 'var(--radius)',
        'brand-sm': 'var(--radius-sm)',
      }
    },
  },
  plugins: [],
}