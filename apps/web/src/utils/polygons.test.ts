import { describe, expect, it } from "vitest";
import {
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
