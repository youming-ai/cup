/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#0A0F0D",
        panel: "#121815",
        panel2: "#1A211D",
        line: "#2A332E",
        chalk: "#EAF2EC",
        chalkdim: "#8A968F",
        pitch: "#2BD96B",
        live: "#FF4438",
      },
      fontFamily: {
        display: ['"Saira Condensed"', "system-ui", "sans-serif"],
        body: ['"Hanken Grotesk"', "system-ui", "sans-serif"],
        mono: ['"Space Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
}
