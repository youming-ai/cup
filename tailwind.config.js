/** @type {import('tailwindcss').Config} */

// 颜色走 CSS 变量（通道值 "R G B"）。用 rgb(var() / <alpha-value>) 包装，
// 让 bg-pitch/40、text-chalkdim/70 这类透明修饰可用（暂无亮色主题）。
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        night: c('--c-bg'),
        panel: c('--c-surface'),
        panel2: c('--c-surface2'),
        line: c('--c-line'),
        chalk: c('--c-text'),
        chalkdim: c('--c-muted'),
        pitch: c('--c-pitch'),
        live: c('--c-live'),
        amber: c('--c-amber'),
      },
      fontFamily: {
        display: ['"Saira Condensed"', 'system-ui', 'sans-serif'],
        body: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
