import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Kept apart from vite.config.ts so unit tests skip the build-only options.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
