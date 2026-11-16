import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("/home redirect (next.config.ts)", () => {
  it("sends /home and /{locale}/home to the start page", async () => {
    expect(await nextConfig.redirects?.()).toEqual([
      { source: "/home", destination: "/", permanent: false },
      { source: "/:locale(es|en)/home", destination: "/:locale", permanent: false },
    ]);
  });
});
