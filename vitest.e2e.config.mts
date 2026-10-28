import { defineConfig } from "vitest/config";

// Pruebas en un navegador de verdad emulando móviles (`npm run test:e2e`). Necesitan la
// app en marcha (`npm run dev`) con la base de datos local y sus datos demo
// (`npm run db:start`). Ver tests/e2e/browser.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
