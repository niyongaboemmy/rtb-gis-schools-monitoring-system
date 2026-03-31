import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import cesium from "vite-plugin-cesium";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  const port = parseInt(env.VITE_PORT ?? "5173");
  const apiTarget = env.VITE_API_TARGET ?? "http://localhost:3001";
  const minioTarget = env.VITE_MINIO_TARGET ?? "http://localhost:9000";

  return {
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
      port,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/public": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/minio": {
          target: minioTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/minio/, ""),
        },
        "/files": {
          target: "http://localhost:3002",
          changeOrigin: true,
          timeout: 3600000,
          proxyTimeout: 3600000,
        },
        // File server upload endpoint
        "/upload": {
          target: "http://localhost:3002",
          changeOrigin: true,
          timeout: 3600000,
          proxyTimeout: 3600000,
        },
        // Backward compat: old DB records still reference /uploads/reports/...
        "/uploads": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
