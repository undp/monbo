import { describe, expect, it } from "vitest";
import { makeAdminLayer } from "@/test/factories";
import { layerBlocker, layerVisibility } from "./layerVisibility";

describe("layerVisibility", () => {
  it("is public when nothing stops it", () => {
    expect(layerVisibility(makeAdminLayer())).toEqual({ status: "public" });
  });

  it.each([
    [{ category_issue: "unknown_category", category_enabled: false }, "unknown_category"],
    [{ category_issue: "invalid_category", category_enabled: false }, "invalid_category"],
    [
      { category_issue: "unreadable_categories", category_enabled: false },
      "unreadable_categories",
    ],
    [{ category_enabled: false }, "category_disabled"],
    [{ layer_issue: "years_mismatch" }, "years_mismatch"],
    [{ layer_issue: "missing_raster", has_raster: false }, "missing_raster"],
  ] as const)("an enabled layer with %o is hidden by %s", (fields, reason) => {
    expect(layerVisibility(makeAdminLayer(fields))).toEqual({ status: "blocked", reason });
  });

  it("says the category first, as the admin fixes it first", () => {
    expect(
      layerBlocker(
        makeAdminLayer({ category_enabled: false, layer_issue: "missing_raster" })
      )
    ).toBe("category_disabled");
  });

  it("tells a hidden layer what would stop publishing it", () => {
    expect(layerVisibility(makeAdminLayer({ enabled: false }))).toEqual({
      status: "hidden",
      reason: null,
    });
    expect(
      layerVisibility(makeAdminLayer({ enabled: false, layer_issue: "years_mismatch" }))
    ).toEqual({ status: "hidden", reason: "years_mismatch" });
  });
});
