import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Overridable so a box where 8000 is already taken by something else can run
// `API_PORT=8010 npm run dev` instead of editing this file.
const apiPort = process.env.API_PORT ?? "8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Keeps the browser on one origin so there is no CORS story in dev.
      "/api": { target: `http://localhost:${apiPort}`, changeOrigin: true },
    },
  },
});
