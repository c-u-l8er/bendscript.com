import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/unit/**/*.{test,spec}.{js,ts}",
      "tests/integration/**/*.{test,spec}.{js,ts}",
    ],
    exclude: [
      "tests/e2e/**",
      "node_modules/**",
      ".svelte-kit/**",
      "build/**",
      "dist/**",
    ],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    pool: "forks",
    teardownTimeout: 3000,
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "tests/coverage",
      include: ["src/lib/**/*.js", "src/routes/**/*.js"],
      exclude: [
        "src/**/*.d.ts",
        "src/routes/**/+page.svelte",
        "src/routes/**/+layout.svelte",
      ],
    },
  },
});
