import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    // The repo root carries its own pnpm-lock.yaml for the orchestrator (see
    // the root package.json), so Turbopack's lockfile-based root inference
    // picks the wrong directory and warns. Pin it to this package.
    root: __dirname,
  },
};

export default nextConfig;
