import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget =
  process.env.RVSF_API_PROXY_TARGET || "http://127.0.0.1:8791";
const apiToken = process.env.RVSF_API_PROXY_TOKEN;

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        secure: true,
        ...(apiToken
          ? { headers: { "x-rvsf-api-token": apiToken } }
          : {})
      }
    }
  },
  build: {
    outDir: "dist"
  }
});
