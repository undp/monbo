import { describe, expect, it } from "vitest";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import { makePolygonFarm } from "@/test/factories";
import { TabTitle } from "./TabTitle";

// TabTitle only reads the context and the translations, so it renders as a hook.
const validTitle = async (farms: number) => {
  const { result } = await renderHookWithData(() => TabTitle({ type: "valid" }), {
    context: makeDataContext({
      farmsData: Array.from({ length: farms }, (_, i) => makePolygonFarm({ id: `F${i}` })),
    }),
  });
  return result.current;
};

describe("TabTitle", () => {
  it("names the valid polygons in singular and plural", async () => {
    expect(await validTitle(1)).toBe("1 polígono validado");
    expect(await validTitle(5)).toBe("5 polígonos validados");
  });
});
