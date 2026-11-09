/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: 'var(--racklyt-bg-canvas, #0b0c0e)',
        surface: 'var(--racklyt-bg-panel, #181b1f)',
        elevated: 'var(--racklyt-bg-active, #22252b)',
        subtle: 'var(--racklyt-border-weak, #22252b)',
        primaryText: 'var(--racklyt-text-primary, #f0f2f5)',
        mutedText: 'var(--racklyt-text-muted, #8b93a4)',
        accent: 'var(--racklyt-orange, #f99c1c)',
        emerald: 'var(--racklyt-green, #73bf69)',
        amber: 'var(--racklyt-yellow, #fade2a)',
        coral: 'var(--racklyt-red, #f2495c)',
        blue: 'var(--racklyt-blue, #3274d9)',
        cyan: 'var(--racklyt-cyan, #70dbff)',
        purple: 'var(--racklyt-purple, #b877d9)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'solid': '0 1px 3px 0 rgba(0, 0, 0, 0.4)',
        'elevated': '0 4px 12px 0 rgba(0, 0, 0, 0.35)',
      }
    },
  },
  plugins: [],
}
