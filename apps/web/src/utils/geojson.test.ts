import { describe, expect, it } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import {
  makeFarm,
  makeMap,
  makeMapResults,
  makePolygonFarm,
  makeValidationResults,
} from "@/test/factories";
import {
  generateGeoJsonFarmsDataWithDeforestationAnalysis,
  generateGeoJsonFarmsDataWithPolygonsValidation,
  generateGeoJsonFeature,
} from "./geojson";

describe("generateGeoJsonFeature", () => {
  it("writes a point farm as a GeoJSON Point, longitude first", () => {
    const feature = generateGeoJsonFeature(makeFarm());
    expect(feature.geometry).toEqual({ type: "Point", coordinates: [-84.3, 10.1] });
  });

  it("writes a polygon farm as one ring of [lng, lat] pairs", () => {
    const feature = generateGeoJsonFeature(makePolygonFarm());
    expect(feature.geometry.type).toBe("Polygon");
    expect(feature.geometry.coordinates).toEqual([
      [
        [-84.3752, 10.1453],
        [-84.3741, 10.1461],
        [-84.3715, 10.1432],
        [-84.3752, 10.1453],
      ],
    ]);
  });

  it("carries the EUDR properties", () => {
    const { properties } = generateGeoJsonFeature(
      makeFarm({ id: "F07", producer: "Luis Mora", country: "CR" })
    );
    expect(properties).toMatchObject({
      id: "F07",
      ProducerName: "Luis Mora",
      ProducerCountry: "CR",
      coordinates: "(-84.3,10.1)",
      cropType: "Café",
    });
  });
});

describe("generateGeoJsonFarmsDataWithPolygonsValidation", () => {
  it("adds each farm's validation status", () => {
    const data = generateGeoJsonFarmsDataWithPolygonsValidation(
      [makeFarm({ id: "F01" }), makeFarm({ id: "F02" })],
      makeValidationResults({ F01: FarmValidationStatus.NOT_VALID })
    );
    expect(data.type).toBe("FeatureCollection");
    expect(data.features.map((f) => f.properties.status)).toEqual(["NOT_VALID", ""]);
  });
});

describe("generateGeoJsonFarmsDataWithDeforestationAnalysis", () => {
  it("adds one formatted deforestation property per layer", () => {
    setRuntimeConfig({
      deforestationThresholdPercentage: 1,
      overlapThresholdPercentage: 0,
    });
    const data = generateGeoJsonFarmsDataWithDeforestationAnalysis(
      [makeFarm({ id: "F01" }), makeFarm({ id: "F02" }), makeFarm({ id: "F03" })],
      [makeMapResults(1, { F01: 0.014, F02: 0.004, F03: null })],
      [makeMap({ id: 1, alias: "GFW" })],
      "es"
    );
    expect(
      data.features.map((f) => f.properties["Deforestation according to GFW"])
    ).toEqual(["1,4%", "< 1%", "N/A"]);
  });

  it("skips layers that are no longer available", () => {
    setRuntimeConfig({
      deforestationThresholdPercentage: 0,
      overlapThresholdPercentage: 0,
    });
    const data = generateGeoJsonFarmsDataWithDeforestationAnalysis(
      [makeFarm({ id: "F01" })],
      [makeMapResults(2, { F01: 0.5 })],
      [makeMap({ id: 1 })],
      "en"
    );
    expect(
      Object.keys(data.features[0].properties).some((key) =>
        key.startsWith("Deforestation according to")
      )
    ).toBe(false);
  });
});
