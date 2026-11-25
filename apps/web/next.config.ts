import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The documentation page reads its Markdown from disk (see
  // src/utils/documentationContent.ts). It is prerendered, but should it ever
  // render at runtime, the files must be in the standalone output.
  outputFileTracingIncludes: {
    "/[locale]/documentation": ["./src/content/documentation/**/*"],
  },
  turbopack: {
    // The repo root carries its own pnpm-lock.yaml for the orchestrator (see
    // the root package.json), so Turbopack's lockfile-based root inference
    // picks the wrong directory and warns. Pin it to this package.
    root: __dirname,
  },
};

export default nextConfig;
