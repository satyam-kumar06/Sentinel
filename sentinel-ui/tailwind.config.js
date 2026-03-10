/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#05080b",
        surface: "#090d12",
        surface2: "#0d1520",
        border: "#162030",
        border2: "#1f3045",
        cyan: "#00e5ff",
        orange: "#ff6d35",
        green: "#29ffa0",
        yellow: "#ffd426",
        red: "#ff3d5a",
        purple: "#a78bfa",
        text: "#b8cfe0",
        muted: "#3d5570",
      },
      fontFamily: {
        mono: ["IBM Plex Mono", "monospace"],
        display: ["Syne", "sans-serif"],
      },
    },
  },
  plugins: [],
};