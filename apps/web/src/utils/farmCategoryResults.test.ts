import { describe, expect, it } from "vitest";
import { makeCategory, makeFrontierCategory, makeMap, makeMapResults } from "@/test/factories";
import { farmCategoryResults } from "./farmCategoryResults";

const deforestation = makeCategory({ thresholdPercentage: 1 });
const frontier = makeFrontierCategory();
const gfw = makeMap({ id: 1, alias: "GFW" });
const tmf = makeMap({ id: 2, alias: "TMF" });
const upra = makeMap({ id: 5, alias: "UPRA", categoryId: frontier.id });
const orphan = makeMap({ id: 9, alias: "X", categoryId: "gone" });

const summary = (values: Record<number, number | null>, layers = [gfw, tmf, upra]) =>
  farmCategoryResults(
    [{ id: "F01" }],
    Object.entries(values).map(([mapId, value]) =>
      makeMapResults(Number(mapId), { F01: value })
    ),
    layers,
    [deforestation, frontier]
  ).get("F01")!;

describe("farmCategoryResults", () => {
  it("takes each category's worst result: a finding in any layer", () => {
    const [def, front] = summary({ 1: 0.05, 2: 0, 5: 1 });

    expect(def.category.id).toBe("deforestation");
    expect(def.resultClass).toBe("flagged");
    expect(def.layers.map(({ resultClass }) => resultClass)).toEqual(["flagged", "ok"]);
    expect(front.resultClass).toBe("ok");
  });

  it("is no data when nothing is flagged and a layer has no result", () => {
    const [def] = summary({ 1: 0, 2: null, 5: 1 });

    expect(def.resultClass).toBe("unknown");
    expect(def.layers[1]).toMatchObject({ value: null, resultClass: "unknown" });
  });

  it("only counts the layers given: an unticked layer is left out", () => {
    const [def] = summary({ 1: 0.05, 2: 0 }, [tmf]);

    expect(def.resultClass).toBe("ok");
    expect(def.layers).toHaveLength(1);
  });

  it("leaves out the layers whose category is missing, and categories without layers", () => {
    const results = summary({ 1: 0, 9: 0.5 }, [gfw, orphan]);

    expect(results.map(({ category }) => category.id)).toEqual(["deforestation"]);
  });
});
