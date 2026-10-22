import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b0713",
        ink2: "#140b22",
        plum: "#4b1263",
        plumGlow: "#7a2e9e",
        gold: "#c9a84c",
        goldBright: "#e8c97a",
        paper: "#f3efe6",
        good: "#4ade80",
        warn: "#fbbf24",
        bad: "#f87171",
      },
      fontFamily: {
        display: ["Sora", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
