import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: "#f4efe2",
        ink: "#2b2118",
        bronze: "#7a5730",
        stamp: "#a53d2f"
      },
      fontFamily: {
        guild: ["Georgia", "Times New Roman", "serif"]
      }
    }
  },
  plugins: []
};

export default config;
