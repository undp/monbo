import type { RuntimeConfig } from "@/config/runtime";
import type {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import type { FarmData } from "@/interfaces/Farm";
import type { DeforestationImageBlob } from "@/utils/deforestationImages";

// Messages between the report page and src/workers/reportPdf.worker.tsx. Everything
// here is structured-cloneable: the worker can't receive `t` or blob URLs, so it
// gets the locale, the runtime config and the images' Blobs.

export interface ReportPdfRequest {
  /** One PDF with every farm, or a ZIP with one PDF per farm. */
  kind: "complete" | "perFarm";
  locale: string;
  showLinks: boolean;
  config: RuntimeConfig;
  farms: FarmData[];
  results: DeforestationAnalysisMapResults[];
  maps: MapData[];
  images: DeforestationImageBlob[];
}

export interface ReportPdfMessage {
  id: number;
  request: ReportPdfRequest;
}

export type ReportPdfResponse =
  | { id: number; blob: Blob }
  | { id: number; error: string };
