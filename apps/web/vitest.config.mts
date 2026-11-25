import { defineConfig } from "vitest/config";

// Unit tests (see the Testing section of README.md). One jsdom environment for the
// whole suite: the hooks need a DOM and the Excel reader needs FileReader.
export default defineConfig({
  resolve: {
    // The `@/` alias, read from tsconfig.json like Next does.
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    // Read by src/config/env.ts when a module is imported: readable URLs in
    // assertions instead of the `__NEXT_PUBLIC_API_URL__` placeholder.
    env: { NEXT_PUBLIC_API_URL: "http://api.test" },
  },
});
