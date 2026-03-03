import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["app/**/*.{test,spec}.{ts,tsx}", "server/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "build", "tests/e2e", "tests/integration"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "tests/coverage",
      exclude: ["node_modules", "build", "tests/**", "app/generated/**"],
    },
    setupFiles: ["tests/setup/unit-setup.ts"],
  },
});
