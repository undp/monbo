import type { NextConfig } from "next";
import i18nConfig from "./src/i18nConfig";

const LOCALES = i18nConfig.locales.join("|");

const nextConfig: NextConfig = {
  output: "standalone",
  // The documentation page reads its Markdown from disk (see
  // src/utils/documentationContent.ts). It is prerendered, but should it ever
  // render at runtime, the files must be in the standalone output.
  outputFileTracingIncludes: {
    "/[locale]/documentation": ["./src/content/documentation/**/*"],
  },
  // The start page shows the three steps now: /home only keeps old links working.
  // Here rather than in a page, because these run before the locale proxy and
  // answer with a real HTTP redirect (a prerendered page's redirect() doesn't).
  async redirects() {
    return [
      { source: "/home", destination: "/", permanent: false },
      {
        source: `/:locale(${LOCALES})/home`,
        destination: "/:locale",
        permanent: false,
      },
    ];
  },
  turbopack: {
    // The repo root carries its own pnpm-lock.yaml for the orchestrator (see
    // the root package.json), so Turbopack's lockfile-based root inference
    // picks the wrong directory and warns. Pin it to this package.
    root: __dirname,
  },
};

export default nextConfig;
