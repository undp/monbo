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
  references: string[];
  considerations: string;
}

export interface DeforestationAnalysisMapResults {
  mapId: number;
  farmResults: {
    farmId: string;
    value: number;
  }[];
}
