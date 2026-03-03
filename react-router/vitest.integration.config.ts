import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/integration/**/*.{test,spec}.ts"],
    testTimeout: 30000,
    setupFiles: ["tests/setup/integration-setup.ts"],
  },
});
