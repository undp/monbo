export interface MapData {
  id: number;
  name: string;
  alias: string;
  baseline: number;
  comparedAgainst: number;
  coverage: string;
  details: string;
  resolution: string;
  contentDate: string;
  updateFrequency: string;
  source: string;
  disclaimer: string;
}

export interface DeforestationAnalysisMapResults {
  mapId: number;
  farmResults: {
    farmId: string;
    value: number;
  }[];
}
