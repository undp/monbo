import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setPathname } from "@/test/navigation";
import { useIsStartPage } from "./useIsStartPage";

describe("useIsStartPage", () => {
  it.each(["/", "/es", "/en", "/en/"])("is true on %s", (pathname) => {
    setPathname(pathname);
    expect(renderHook(useIsStartPage).result.current).toBe(true);
  });

  it.each(["/home", "/en/documentation", "/polygons-validation", "/english"])(
    "is false on %s",
    (pathname) => {
      setPathname(pathname);
      expect(renderHook(useIsStartPage).result.current).toBe(false);
    }
  );
});
