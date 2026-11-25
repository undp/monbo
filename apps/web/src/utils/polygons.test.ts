import { describe, expect, it } from "vitest";
import { createTestI18n } from "@/test/i18n";
import { makeMultiPolygonFarm, makePolygonFarm } from "@/test/factories";
import type { PolygonPart } from "@/interfaces/Map";
import {
  getPolygonVertices,
  parseAreaToHectares,
  parseLatitude,
  parseLongitude,
  parsePolygonArea,
} from "./polygons";

describe("parsePolygonArea", () => {
  it("shows up to 5000 m² in square meters", () => {
    expect(parsePolygonArea(35.93, "es")).toBe("36 m²");
    expect(parsePolygonArea(5000, "es")).toBe("5.000 m²");
    expect(parsePolygonArea(5000, "en")).toBe("5,000 m²");
  });

  it("switches to hectares above 5000 m², with two decimals", () => {
    expect(parsePolygonArea(5001, "es")).toBe("0,5 ha");
    expect(parsePolygonArea(67074.88, "es")).toBe("6,71 ha");
    expect(parsePolygonArea(67074.88, "en")).toBe("6.71 ha");
  });
});

describe("parseAreaToHectares", () => {
  it("converts square meters to hectares", () => {
    expect(parseAreaToHectares(67074.88)).toBe("6,71 ha");
    expect(parseAreaToHectares(540004.05, 2, true, "en")).toBe("54 ha");
  });

  it("can leave out the unit and use fewer decimals", () => {
    expect(parseAreaToHectares(67074.88, 1, false, "en")).toBe("6.7");
  });
});

describe("coordinates", () => {
  it("names the latitude's hemisphere", () => {
    expect(parseLatitude(10.1)).toBe("10.100000° (N)");
    expect(parseLatitude(-33.45)).toBe("33.450000° (S)");
  });

  it("names the longitude's direction (O for west)", () => {
    expect(parseLongitude(-84.3752215666988)).toBe("84.375222° (O)");
    expect(parseLongitude(12.5)).toBe("12.500000° (E)");
  });
});


describe("getPolygonVertices", () => {
  const partsOf = (farm: ReturnType<typeof makePolygonFarm>): PolygonPart[] =>
    farm.polygon.type === "polygon" ? (farm.polygon.details?.parts ?? []) : [];

  it("numbers the vertices of a farm with one ring, as before", async () => {
    const { t } = await createTestI18n("es");
    const vertices = getPolygonVertices(partsOf(makePolygonFarm()), t);
    expect(vertices.map(({ label }) => label)).toEqual(["1", "2", "3", "4"]);
  });

  it("names the part and ring of each vertex when there are several", async () => {
    const { t } = await createTestI18n("es");
    const labels = getPolygonVertices(partsOf(makeMultiPolygonFarm()), t).map(
      ({ label }) => label
    );
    expect(labels.length).toBe(15);
    expect(labels[0]).toBe("Parte 1 · Exterior · 1");
    expect(labels[5]).toBe("Parte 1 · Hueco 1 · 1");
    expect(labels[10]).toBe("Parte 2 · Exterior · 1");
  });

  it("leaves the part out for a single part with a hole", async () => {
    const { t } = await createTestI18n("en");
    const [withHole] = partsOf(makeMultiPolygonFarm());
    const labels = getPolygonVertices([withHole], t).map(({ label }) => label);
    expect(labels[0]).toBe("Exterior · 1");
    expect(labels[5]).toBe("Hole 1 · 1");
  });
});
