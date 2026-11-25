import { describe, expect, it } from "vitest";
import { LARGE_REPORT_FARM_PAGES } from "@/config/constants";
import type { FarmData } from "@/interfaces/Farm";
import { makeFarm, makeMapResults } from "@/test/factories";
import { countFarmPages, isLargeReport } from "./reportSize";

const farms = (n: number): FarmData[] =>
  Array.from({ length: n }, (_, i) => makeFarm({ id: `F${i}` }));

/** One layer's results with a value for every farm, or null for the first `nulls`. */
const layer = (mapId: number, list: FarmData[], nulls = 0) =>
  makeMapResults(
    mapId,
    Object.fromEntries(list.map(({ id }, i) => [id, i < nulls ? null : 0.1]))
  );

describe("countFarmPages", () => {
  it("counts the selected (farm, layer) pairs that have a result", () => {
    const all = farms(300);
    const results = [1, 2, 3, 4].map((mapId) => layer(mapId, all, mapId === 1 ? 60 : 0));

    expect(countFarmPages(all, results)).toBe(300 * 4 - 60);
  });

  it("ignores the farms that aren't selected", () => {
    const all = farms(10);
    expect(countFarmPages(all.slice(0, 3), [layer(1, all), layer(2, all)])).toBe(6);
  });
});

describe("isLargeReport", () => {
  it("is large only above the threshold", () => {
    expect(LARGE_REPORT_FARM_PAGES).toBe(1000);
    // 250 farms x 4 layers: exactly at the threshold, still small.
    expect(isLargeReport(250 * 4)).toBe(false);
    // 300 x 4 with 60 pairs without a result: 1140 pages.
    expect(isLargeReport(300 * 4 - 60)).toBe(true);
  });
});
