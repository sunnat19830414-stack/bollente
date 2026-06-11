export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2563eb', dark: '#1d4ed8' },
        success: '#16a34a',
        warning: '#d97706',
        danger:  '#dc2626',
      }
    }
  },
  plugins: []
}
