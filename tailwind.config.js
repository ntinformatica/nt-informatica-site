/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        nt: {
          blue: "#0EA5E9",
          cyan: "#38BDF8",
          ink: "#05070D",
          panel: "#111827",
          line: "#253044",
        },
      },
      boxShadow: {
        glow: "0 0 28px rgba(14, 165, 233, 0.28)",
        card: "0 22px 60px rgba(0, 0, 0, 0.35)",
      },
      backgroundImage: {
        grid:
          "linear-gradient(rgba(56, 189, 248, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.12) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
