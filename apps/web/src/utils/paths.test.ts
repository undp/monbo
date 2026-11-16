import { describe, expect, it } from "vitest";
import { isAdminPath } from "./paths";

describe("isAdminPath", () => {
  it.each(["/admin", "/admin/layers/3", "/en/admin", "/es/admin/usage"])(
    "is true on %s",
    (pathname) => expect(isAdminPath(pathname)).toBe(true)
  );

  it.each(["/", "/en", "/administration", "/documentation", "/polygons-validation"])(
    "is false on %s",
    (pathname) => expect(isAdminPath(pathname)).toBe(false)
  );
});
