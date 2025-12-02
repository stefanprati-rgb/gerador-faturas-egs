/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#191948',
                    dark: '#12123B',
                },
                secondary: '#4CAF50',
                background: '#F7F8FA',
                card: '#FFFFFF',
                border: '#E7EBF0',
                text: {
                    DEFAULT: '#0B1220',
                    muted: '#6B7280',
                },
                error: '#EF4444',
                success: '#10B981',
                warning: '#F59E0B',
            },
            fontFamily: {
                sans: ['Poppins', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
