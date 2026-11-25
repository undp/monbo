import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateFarmsData } from "./farms";
import { validatePolygons } from "./polygonValidation";
import { analizeDeforestation } from "./deforestationAnalysis";
import { readUsageSession } from "@/utils/usageSession";
import type { FarmData } from "@/interfaces/Farm";
import type { MapData } from "@/interfaces/DeforestationAnalysis";

// Upload, validation and analysis carry the usage context in headers (spec
// "Requests carry the usage context in headers").

const fetchMock = vi.fn();
const farm = {
  id: "f1",
  polygon: { type: "point", details: { center: { lat: 1, lng: 2 }, radius: 10 } },
} as unknown as FarmData;

const sentHeaders = () => fetchMock.mock.calls[0][1].headers as Record<string, string>;

beforeEach(() => {
  fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

describe("usage headers", () => {
  it("are sent with an upload, with its module", async () => {
    await generateFarmsData([{}], "es", {
      country: "CR",
      module: "polygons-validation",
    });
    expect(sentHeaders()).toMatchObject({
      "X-Monbo-Session": readUsageSession(),
      "X-Monbo-Country": "CR",
      "X-Monbo-Module": "polygons-validation",
    });
  });

  it("are sent with a validation", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ farmResults: [], inconsistencies: [] }))
    );
    await validatePolygons([farm], "PE");
    expect(sentHeaders()).toMatchObject({
      "X-Monbo-Session": readUsageSession(),
      "X-Monbo-Country": "PE",
    });
    expect(sentHeaders()).not.toHaveProperty("X-Monbo-Module");
  });

  it("are sent with an analysis", async () => {
    await analizeDeforestation([farm], [{ id: 3 } as MapData], "EC");
    expect(sentHeaders()).toMatchObject({
      "X-Monbo-Session": readUsageSession(),
      "X-Monbo-Country": "EC",
    });
  });
});
