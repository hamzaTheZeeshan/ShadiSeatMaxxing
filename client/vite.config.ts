import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_PROXY_TARGET || "https://shadiseatmaxxing-backend.vercel.app";
  return {
    plugins: [react()],
    server: {
      // Same-origin in dev: the browser calls /api/..., Vite forwards to Django (no CORS needed).
      proxy: {
        "/api": { target, changeOrigin: true },
      },
    },
  };
});