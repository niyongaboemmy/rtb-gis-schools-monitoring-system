import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "VITE_");

  const port = parseInt(env.VITE_PORT ?? "5173");
  const apiTarget = env.VITE_API_TARGET ?? "http://localhost:3001";
  const minioTarget = env.VITE_MINIO_TARGET ?? "http://localhost:9000";

  return {
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      include: ["react", "react-dom", "socket.io-client", "debug"],
    },
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
        include: [/node_modules/],
      },
      // three.js is one library (~700 KB min) that only the 3D viewer loads.
      chunkSizeWarningLimit: 800,
      rolldownOptions: {
        output: {
          // Big libraries get their own long-lived chunks: a deploy that only
          // changes app code leaves them cached. Each still loads only with
          // the lazy page that imports it (see App.tsx / SchoolMap.tsx).
          codeSplitting: {
            groups: [
              { name: "three", test: /node_modules[\\/](three|three-mesh-bvh)[\\/]/, priority: 40 },
              { name: "openlayers", test: /node_modules[\\/](ol|geotiff|rbush|quickselect|earcut|pbf|color-[a-z]+)[\\/]/, priority: 40 },
              { name: "leaflet", test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/, priority: 40 },
              {
                name: "charts",
                test: /node_modules[\\/](recharts|victory-vendor|@reduxjs|redux|react-redux|immer|reselect|es-toolkit|decimal\.js-light|eventemitter3)[\\/]/,
                priority: 40,
              },
              // Highest priority: groups also capture their dependencies, so
              // React must be claimed here first or it lands in (and drags
              // the entry onto) the leaflet/charts chunks.
              { name: "react", test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/, priority: 60 },
              { name: "motion", test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/, priority: 50 },
              // d3-geo (sign-in globe, dashboard backdrop) shares d3-array with
              // recharts; its own small chunk keeps charts off the entry path.
              { name: "geo", test: /node_modules[\\/](d3-geo|d3-array|internmap)[\\/]/, priority: 55 },
              // Tiny helpers the app shell and recharts both use (cn(), stores).
              { name: "core", test: /node_modules[\\/](clsx|tailwind-merge|zustand|use-sync-external-store|tiny-invariant)[\\/]/, priority: 55 },
            ],
          },
        },
      },
    },
    server: {
      port,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/socket.io": {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
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
