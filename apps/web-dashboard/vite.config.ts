import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.PORT ?? 3000),
    host: "0.0.0.0",
    proxy: {
      "/machines": apiProxyTarget,
      "/sessions": apiProxyTarget,
      "/command": apiProxyTarget,
      "/commands": apiProxyTarget,
      "/assess": apiProxyTarget,
      "/server-info": apiProxyTarget,
      "/ws": {
        target: apiProxyTarget,
        ws: true,
      },
      "/admin": apiProxyTarget,
      "/health": apiProxyTarget,
    },
  },
  preview: {
    port: Number(process.env.PORT ?? 3000),
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/machines": apiProxyTarget,
      "/sessions": apiProxyTarget,
      "/command": apiProxyTarget,
      "/commands": apiProxyTarget,
      "/assess": apiProxyTarget,
      "/server-info": apiProxyTarget,
      "/ws": {
        target: apiProxyTarget,
        ws: true,
      },
      "/admin": apiProxyTarget,
      "/health": apiProxyTarget,
    },
  },
});
