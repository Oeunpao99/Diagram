import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Keeps the browser on one origin so there is no CORS story in dev.
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
