import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

const request = (path: string, locale?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: locale ? { cookie: `NEXT_LOCALE=${locale}` } : {},
  });

const locationOf = (response: Response) =>
  response.headers.get("location")?.replace("http://localhost:3000", "");

describe("proxy", () => {
  it.each([
    ["/home", "/"],
    ["/home/", "/"],
    ["/es/home", "/es"],
    ["/en/home", "/en"],
  ])("redirects %s to the start page (%s)", (path, target) => {
    const response = proxy(request(path));

    expect(response.status).toBe(307);
    expect(locationOf(response)).toBe(target);
  });

  it("leaves the locale of /home to the locale router, which follows the cookie", () => {
    const toStart = proxy(request("/home", "en"));
    expect(locationOf(toStart)).toBe("/");

    const toEnglish = proxy(request("/", "en"));
    expect(toEnglish.status).toBe(307);
    expect(locationOf(toEnglish)).toBe("/en");
  });

  it.each(["/", "/documentation", "/polygons-validation/upload-data"])(
    "rewrites %s to Spanish without redirecting",
    (path) => {
      const response = proxy(request(path));

      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-middleware-rewrite")).toContain(
        `/es${path === "/" ? "" : path}`
      );
    }
  );

  it("doesn't touch paths that only contain home", () => {
    const response = proxy(request("/homes"));

    expect(response.headers.get("location")).toBeNull();
  });
});
