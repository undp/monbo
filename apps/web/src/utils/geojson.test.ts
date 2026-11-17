import { describe, expect, it } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import type { TFunction } from "i18next";
import { createTestI18n } from "@/test/i18n";
import {
  makeCategory,
  makeFarm,
  makeFrontierCategory,
  makeMap,
  makeMapResults,
  makeMultiPolygonFarm,
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

  it("writes a farm with a hole as one Polygon, the hole as an inner ring", () => {
    const farm = makeMultiPolygonFarm();
    if (farm.polygon.type !== "polygon" || !farm.polygon.details) throw new Error();
    farm.polygon.details.parts = farm.polygon.details.parts.slice(0, 1);
    const { geometry } = generateGeoJsonFeature(farm);
    expect(geometry.type).toBe("Polygon");
    expect(geometry.coordinates).toHaveLength(2);
  });

  it("writes a farm of several parts as a MultiPolygon", () => {
    const { geometry } = generateGeoJsonFeature(makeMultiPolygonFarm());
    expect(geometry.type).toBe("MultiPolygon");
    expect(geometry.coordinates).toHaveLength(2);
    expect((geometry.coordinates as number[][][][])[0]).toHaveLength(2);
    expect((geometry.coordinates as number[][][][])[0][0][1]).toEqual([0.01, 0]);
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
  const tFor = async (locale: "es" | "en") =>
    (await createTestI18n(locale)).getFixedT(locale) as TFunction;
  const categories = [makeCategory({ thresholdPercentage: 2 }), makeFrontierCategory()];

  it("adds each layer's finding and result, named after its category, in Spanish", async () => {
    setRuntimeConfig({
      deforestationThresholdPercentage: 1,
      overlapThresholdPercentage: 0,
    });
    const data = generateGeoJsonFarmsDataWithDeforestationAnalysis(
      [makeFarm({ id: "F01" }), makeFarm({ id: "F02" }), makeFarm({ id: "F03" })],
      [makeMapResults(1, { F01: 0.014, F02: 0.004, F03: null })],
      [makeMap({ id: 1, alias: "GFW" })],
      [makeCategory({ thresholdPercentage: 1 })],
      await tFor("es"),
      "es"
    );
    const property = (key: string) =>
      data.features.map((f) => f.properties[key]);
    expect(property("Deforestación · GFW — % hallazgo")).toEqual([
      "1,4%",
      "< 1%",
      "Sin dato",
    ]);
    expect(property("Deforestación · GFW — Resultado")).toEqual([
      "Con deforestación",
      "Libre de deforestación",
      "Sin dato",
    ]);
  });

  it("reads a required category by what lies outside its layer, in English", async () => {
    const data = generateGeoJsonFarmsDataWithDeforestationAnalysis(
      [makeFarm({ id: "F01" })],
      [makeMapResults(5, { F01: 0.82 })],
      [makeMap({ id: 5, alias: "UPRA", categoryId: "agricultural_frontier" })],
      categories,
      await tFor("en"),
      "en"
    );
    expect(data.features[0].properties).toMatchObject({
      "Agricultural frontier · UPRA — % finding": "18%",
      "Agricultural frontier · UPRA — Result": "Outside the agricultural frontier",
    });
  });

  it("says No data for a layer whose category is unknown", async () => {
    const data = generateGeoJsonFarmsDataWithDeforestationAnalysis(
      [makeFarm({ id: "F01" })],
      [makeMapResults(5, { F01: 0.5 })],
      [makeMap({ id: 5, alias: "X", categoryId: "gone" })],
      categories,
      await tFor("en"),
      "en"
    );
    expect(data.features[0].properties).toMatchObject({
      "No category · X — % finding": "No data",
      "No category · X — Result": "No data",
    });
  });

  it("skips layers that are no longer available", async () => {
    const data = generateGeoJsonFarmsDataWithDeforestationAnalysis(
      [makeFarm({ id: "F01" })],
      [makeMapResults(2, { F01: 0.5 })],
      [makeMap({ id: 1 })],
      categories,
      await tFor("en"),
      "en"
    );
    expect(
      Object.keys(data.features[0].properties).some((key) =>
        key.includes(" — ")
      )
    ).toBe(false);
  });
});
