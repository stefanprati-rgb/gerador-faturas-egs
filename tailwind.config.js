/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#0071E3',
                    dark: '#0077ED',
                },
                secondary: '#86868B',
                success: '#34C759',
                warning: '#FF9F0A',
                danger: '#FF3B30',
                background: '#F5F5F7',
                card: '#FFFFFF',
                text: {
                    DEFAULT: '#1D1D1F',
                    muted: '#86868B',
                },
                border: '#D2D2D7'
            },
            fontFamily: {
                sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
