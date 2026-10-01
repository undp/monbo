export interface MapData {
  id: number;
  name: string;
  alias: string;
  baseline: number;
  comparedAgainst: number;
  coverage: string;
  source: string;
  resolution: string;
  contentDate: string;
  updateFrequency: string;
  publishDate: string;
  references: string[];
  considerations: string;
  availableCountriesCodes: string[];
  version: number;
  pixelSize: number;
}

export interface DeforestationAnalysisMapResults {
  mapId: number;
  // The layer version the results were computed against.
  version: number;
  farmResults: {
    farmId: string;
    value: number;
  }[];
}
