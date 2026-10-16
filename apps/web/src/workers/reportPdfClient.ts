import type { RuntimeConfig } from "@/config/runtime";
import type {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import type { FarmData } from "@/interfaces/Farm";
import type { DeforestationImageBlob } from "@/utils/deforestationImages";
import type {
  ReportPdfMessage,
  ReportPdfRequest,
  ReportPdfResponse,
} from "./reportPdfProtocol";

/** A large report's ZIP being built in the worker, farm by farm. */
export interface ZipJob {
  /** Adds one farm's PDF; resolves with the number of farms in the ZIP. */
  add(
    farm: FarmData,
    results: DeforestationAnalysisMapResults[],
    images: DeforestationImageBlob[]
  ): Promise<number>;
  finish(): Promise<Blob>;
  /** Drops the ZIP in the worker. */
  cancel(): void;
}

type Answer = Blob | number;

/** The page unmounted before the render was answered, or before it started. */
export class ReportPdfWorkerTerminatedError extends Error {
  constructor() {
    super("The report worker was terminated");
  }
}

/** Promise-based access to src/workers/reportPdf.worker.tsx. Created lazily. */
export class ReportPdfClient {
  private worker: Worker | null = null;
  private nextId = 0;
  private nextJob = 0;
  private pending = new Map<
    number,
    { resolve: (answer: Answer) => void; reject: (error: Error) => void }
  >();

  render(request: ReportPdfRequest): Promise<Blob> {
    return this.send((id) => ({ id, request })) as Promise<Blob>;
  }

  /** Starts a ZIP job in the worker; its farms are added one by one. */
  async startZip(params: {
    locale: string;
    config: RuntimeConfig;
    maps: MapData[];
  }): Promise<ZipJob> {
    const job = this.nextJob++;
    const command = (zip: Extract<ReportPdfMessage, { job: number }>["zip"]) =>
      this.send((id) => ({ id, job, zip }));
    await command({ op: "start", ...params });
    return {
      add: (farm, results, images) =>
        command({ op: "add", farm, results, images }) as Promise<number>,
      finish: () => command({ op: "finish" }) as Promise<Blob>,
      cancel: () => {
        // Nothing to cancel once the worker is gone (terminate rejected the rest).
        if (this.worker) void command({ op: "cancel" }).catch(() => {});
      },
    };
  }

  private send(message: (id: number) => ReportPdfMessage): Promise<Answer> {
    const worker = this.getWorker();
    const id = this.nextId++;
    return new Promise<Answer>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage(message(id));
    });
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.forEach(({ reject }) =>
      reject(new ReportPdfWorkerTerminatedError())
    );
    this.pending.clear();
  }

  private getWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(
      new URL("./reportPdf.worker.tsx", import.meta.url),
      { type: "module" }
    );
    worker.onmessage = (event: MessageEvent<ReportPdfResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id);
      if ("blob" in response) pending.resolve(response.blob);
      else if ("added" in response) pending.resolve(response.added);
      else pending.reject(new Error(response.error));
    };
    worker.onerror = (event) => {
      // The worker failed to load or crashed: fail every pending render.
      const error = new Error(event.message || "The report worker failed");
      this.pending.forEach(({ reject }) => reject(error));
      this.pending.clear();
      this.worker?.terminate();
      this.worker = null;
    };
    this.worker = worker;
    return worker;
  }
}
