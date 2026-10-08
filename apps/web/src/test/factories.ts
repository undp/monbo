import type { FarmData } from "@/interfaces/Farm";
import type {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
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
        path: [
          { lat: 10.1453, lng: -84.3752 },
          { lat: 10.1461, lng: -84.3741 },
          { lat: 10.1432, lng: -84.3715 },
          { lat: 10.1453, lng: -84.3752 },
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
