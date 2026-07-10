import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Run with the same timezone as Vercel so timezone-handling bugs
    // surface in tests rather than only in production.
    env: { TZ: "UTC" },
  },
});
