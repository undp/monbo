import type { components } from "@/api/schema";

// Generated from the API's OpenAPI (`pnpm contracts`); don't edit the shapes here.
// The web's names differ from the API's: a layer is `BaseMapData` there, and a
// layer's results are `MapData`.
export type MapData = components["schemas"]["BaseMapData"];
export type DeforestationAnalysisMapResults = components["schemas"]["MapData"];
