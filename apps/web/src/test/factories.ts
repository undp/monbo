import type { FarmData } from "@/interfaces/Farm";
import type {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import type {
  FarmValidationStatus,
  ValidateFarmsResponse,
} from "@/interfaces/PolygonValidation";

// Typed test data: a field added to the API contract fails the type-check here,
// not in every test.

export const makeFarm = (overrides: Partial<FarmData> = {}): FarmData => ({
  id: "F01",
  producer: "Ana Pérez",
  producerId: "P01",
  production: 100,
  productionDate: "2024-11-25T00:00:00.000Z",
  productionQuantityUnit: "kg",
  country: "CR",
  region: "Alajuela",
  cropType: "Café",
  association: null,
  documents: [],
  polygon: {
    type: "point",
    area: 10000,
    details: { center: { lat: 10.1, lng: -84.3 }, radius: 56.42 },
  },
  ...overrides,
});

export const makePolygonFarm = (overrides: Partial<FarmData> = {}): FarmData =>
  makeFarm({
    polygon: {
      type: "polygon",
      area: 67074.88,
      details: {
        center: { lat: 10.1445, lng: -84.3734 },
        parts: [
          {
            exterior: [
              { lat: 10.1453, lng: -84.3752 },
              { lat: 10.1461, lng: -84.3741 },
              { lat: 10.1432, lng: -84.3715 },
              { lat: 10.1453, lng: -84.3752 },
            ],
            holes: [],
          },
        ],
      },
    },
    ...overrides,
  });

const ring = (...points: [number, number][]) =>
  points.map(([lng, lat]) => ({ lng, lat }));

/** A farm of two parts, the first with a hole, as the API returns it. */
export const makeMultiPolygonFarm = (
  overrides: Partial<FarmData> = {}
): FarmData =>
  makeFarm({
    polygon: {
      type: "polygon",
      area: 1_100_000,
      details: {
        center: { lat: 0.0005, lng: 0.0005 },
        parts: [
          {
            exterior: ring([0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]),
            holes: [
              ring(
                [0.004, 0.004],
                [0.004, 0.006],
                [0.006, 0.006],
                [0.006, 0.004],
                [0.004, 0.004]
              ),
            ],
          },
          {
            exterior: ring([0.05, 0], [0.06, 0], [0.06, 0.01], [0.05, 0.01], [0.05, 0]),
            holes: [],
          },
        ],
      },
    },
    ...overrides,
  });

export const makeMap = (overrides: Partial<MapData> = {}): MapData => ({
  id: 1,
  name: "Global Forest Watch",
  alias: "GFW",
  availableCountriesCodes: ["CR"],
  baseline: 2020,
  categoryId: "deforestation",
  comparedAgainst: 2023,
  considerations: null,
  contentDate: null,
  country: "CR",
  coverage: null,
  pixelSize: 30,
  publishDate: null,
  references: [],
  resolution: null,
  source: null,
  updateFrequency: null,
  version: 1,
  ...overrides,
});

/** The built-in deforestation category of every country, with a 2% threshold. */
export const makeCategory = (
  overrides: Partial<LayerCategory> = {}
): LayerCategory => ({
  id: "deforestation",
  name: { es: "Deforestación", en: "Deforestation" },
  description: {
    es: "Pérdida de bosque después de la línea base.",
    en: "Forest loss after the baseline.",
  },
  icon: "forest",
  color: "#c62828",
  polarity: "avoid",
  thresholdPercentage: 2,
  resultLabels: {
    ok: { es: "Libre de deforestación", en: "Deforestation free" },
    flagged: { es: "Con deforestación", en: "With deforestation" },
  },
  temporal: true,
  ...overrides,
});

/** The agricultural frontier: a `required` category (outside it is the finding). */
export const makeFrontierCategory = (
  overrides: Partial<LayerCategory> = {}
): LayerCategory =>
  makeCategory({
    id: "agricultural_frontier",
    name: { es: "Frontera agrícola", en: "Agricultural frontier" },
    description: {
      es: "Superficie fuera de la frontera agrícola.",
      en: "Area outside the agricultural frontier.",
    },
    icon: "agriculture",
    color: "#2e7d32",
    polarity: "required",
    thresholdPercentage: 5,
    resultLabels: {
      ok: { es: "Dentro de la frontera", en: "Inside the frontier" },
      flagged: { es: "Fuera de la frontera", en: "Outside the frontier" },
    },
    temporal: false,
    ...overrides,
  });

/** One layer's results: `values` maps each farm id to its deforestation (0-1). */
export const makeMapResults = (
  mapId: number,
  values: Record<string, number | null>,
  version = 1
): DeforestationAnalysisMapResults => ({
  mapId,
  version,
  farmResults: Object.entries(values).map(([farmId, value]) => ({
    farmId,
    value,
  })),
});

/** Polygon validation results with no inconsistencies. */
export const makeValidationResults = (
  statuses: Record<string, FarmValidationStatus>
): ValidateFarmsResponse => ({
  farmResults: Object.entries(statuses).map(([farmId, status]) => ({
    farmId,
    status,
  })),
  inconsistencies: [],
});

/** The built-in deforestation category, as `GET /categories` returns it. */
export const makeCategory = (
  overrides: Partial<LayerCategory> = {}
): LayerCategory => ({
  id: "deforestation",
  name: { es: "Deforestación", en: "Deforestation" },
  description: {
    es: "Pérdida de bosque después de la línea base.",
    en: "Forest loss after the baseline.",
  },
  icon: "forest",
  color: "#c62828",
  polarity: "avoid",
  thresholdPercentage: 0,
  resultLabels: {
    ok: { es: "Libre de deforestación", en: "Deforestation-free" },
    flagged: { es: "Con deforestación", en: "With deforestation" },
  },
  temporal: true,
  ...overrides,
});

/** An agricultural frontier category: being outside the layer is the finding. */
export const makeFrontierCategory = (
  overrides: Partial<LayerCategory> = {}
): LayerCategory =>
  makeCategory({
    id: "agricultural_frontier",
    name: { es: "Frontera agrícola", en: "Agricultural frontier" },
    description: {
      es: "Zonas donde se permite la producción agropecuaria.",
      en: "Areas where farming is allowed.",
    },
    icon: "agriculture",
    color: "#a8741a",
    polarity: "required",
    thresholdPercentage: 5,
    resultLabels: {
      ok: {
        es: "Dentro de la frontera agrícola",
        en: "Inside the agricultural frontier",
      },
      flagged: {
        es: "Fuera de la frontera agrícola",
        en: "Outside the agricultural frontier",
      },
    },
    temporal: false,
    ...overrides,
  });
