/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#1a1a1a', 
          light: '#fafafa', 
          gold: '#f59e0b', 
          green: '#15803d' 
        }
      }
    },
  },
  plugins: [],
}