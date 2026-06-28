import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/machines": "http://localhost:8000",
      "/sessions": "http://localhost:8000",
      "/command": "http://localhost:8000",
      "/commands": "http://localhost:8000",
    },
  },
});
