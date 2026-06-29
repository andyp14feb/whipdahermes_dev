import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/machines": apiProxyTarget,
      "/sessions": apiProxyTarget,
      "/command": apiProxyTarget,
      "/commands": apiProxyTarget,
    },
  },
});
