import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import cesium from "vite-plugin-cesium";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cesium()],
  optimizeDeps: {
    include: ["cesium", "react", "react-dom"],
  },
  resolve: {
    dedupe: ["react", "react-dom", "cesium", "resium"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      resium: path.resolve(__dirname, "node_modules/resium/src/index.ts"),
    },
  },
  ssr: {
    noExternal: ["resium", "cesium"],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/resium/, /node_modules/],
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/public": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/minio": {
        target: "http://localhost:9000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/minio/, ""),
      },
    },
  },
});
