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
}

export interface DeforestationAnalysisMapResults {
  mapId: number;
  farmResults: {
    farmId: string;
    value: number;
  }[];
}
