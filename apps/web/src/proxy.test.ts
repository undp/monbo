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
    ["/es/home", "/"],
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

  describe("old stage 2 routes", () => {
    it.each([
      ["/deforestation-analysis", "/territorial-analysis"],
      ["/deforestation-analysis/", "/territorial-analysis/"],
      ["/deforestation-analysis/upload-data", "/territorial-analysis/upload-data"],
      ["/es/deforestation-analysis", "/es/territorial-analysis"],
      ["/es/deforestation-analysis/upload-data", "/es/territorial-analysis/upload-data"],
      ["/en/deforestation-analysis", "/en/territorial-analysis"],
      ["/en/deforestation-analysis/upload-data", "/en/territorial-analysis/upload-data"],
    ])("redirects %s permanently to %s", (path, target) => {
      const response = proxy(request(path));

      expect(response.status).toBe(308);
      expect(locationOf(response)).toBe(target);
    });

    it("keeps the query string", () => {
      const response = proxy(request("/en/deforestation-analysis/upload-data?source=pdf&x=1"));

      expect(response.status).toBe(308);
      expect(locationOf(response)).toBe("/en/territorial-analysis/upload-data?source=pdf&x=1");
    });

    it("keeps the requested language prefix whatever the cookie says", () => {
      const response = proxy(request("/es/deforestation-analysis", "en"));

      expect(locationOf(response)).toBe("/es/territorial-analysis");
    });

    it("then lets the locale router drop the Spanish prefix and remember Spanish", () => {
      const response = proxy(request("/es/territorial-analysis", "en"));

      expect(locationOf(response)).toBe("/territorial-analysis");
      expect(response.cookies.get("NEXT_LOCALE")?.value).toBe("es");
    });

    it.each(["/deforestation-analysis-old", "/en/deforestation-analysisx"])(
      "doesn't redirect %s, which only starts like the old route",
      (path) => {
        const response = proxy(request(path));

        expect(locationOf(response) ?? "").not.toContain("territorial-analysis");
      }
    );

    it.each(["/territorial-analysis", "/territorial-analysis/upload-data"])(
      "serves the new route %s in Spanish without redirecting",
      (path) => {
        const response = proxy(request(path));

        expect(response.headers.get("location")).toBeNull();
        expect(response.headers.get("x-middleware-rewrite")).toContain(`/es${path}`);
      }
    );
  });
});
