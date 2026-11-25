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

/**
 * A large report's ZIP, built farm by farm (one job per download): the page starts
 * the job, adds each farm with only that farm's results and images as they arrive,
 * and finishes it. The worker never holds more than the farms in flight.
 */
export type ZipCommand =
  | {
      op: "start";
      locale: string;
      config: RuntimeConfig;
      maps: MapData[];
    }
  | {
      op: "add";
      farm: FarmData;
      /** Only this farm's results, per selected layer. */
      results: DeforestationAnalysisMapResults[];
      images: DeforestationImageBlob[];
    }
  | { op: "finish" }
  | { op: "cancel" };

export type ReportPdfMessage =
  | { id: number; request: ReportPdfRequest }
  | { id: number; job: number; zip: ZipCommand };

export type ReportPdfResponse =
  | { id: number; blob: Blob }
  | { id: number; error: string }
  /** A ZIP job's `start`, `add` or `cancel` was done: `added` farms are in its ZIP. */
  | { id: number; added: number };
