/** @type {import('tailwindcss').Config} */

// 颜色走 CSS 变量（通道值 "R G B"），主题在 :root / :root.light 间翻转。
// rgb(var() / <alpha-value>) 让 bg-pitch/40、text-chalkdim/70 这类透明修饰继续可用。
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        night: c("--c-bg"),
        panel: c("--c-surface"),
        panel2: c("--c-surface2"),
        line: c("--c-line"),
        chalk: c("--c-text"),
        chalkdim: c("--c-muted"),
        pitch: c("--c-pitch"),
        live: c("--c-live"),
      },
      fontFamily: {
        display: ['"Saira Condensed"', "system-ui", "sans-serif"],
        body: ['"Hanken Grotesk"', "system-ui", "sans-serif"],
        mono: ['"Space Mono"', "ui-monospace", "monospace"],
      },
      // 直角风格：整套圆角刻度归零，rounded-* 一律输出 0。
      borderRadius: {
        none: "0",
        sm: "0",
        DEFAULT: "0",
        md: "0",
        lg: "0",
        xl: "0",
        "2xl": "0",
        "3xl": "0",
        full: "0",
      },
    },
  },
  plugins: [],
};
