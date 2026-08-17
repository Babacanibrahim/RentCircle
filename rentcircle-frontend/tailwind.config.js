/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#1e293b",       // Slate-800 (Boğucu olmayan, yumuşak mat arka plan)
          bgLight: "#334155",  // Slate-700 (Kartlar için bir ton açık, ferah gri-mavi)
          border: "#475569",   // Slate-600 (Zarif kenarlıklar)
          brand: "#3b82f6",    // Canlı neon mavi
          accent: "#8b5cf6",   // Tatlı mor/indigo geçişi
          text: "#f8fafc",     // Parlak ve net okunabilir beyaz (slate-50)
          muted: "#cbd5e1",    // Slate-300 (Yumuşak alt metinler)
        }
      }
    },
  },
  plugins: [],
};