import type {
  ReportPdfMessage,
  ReportPdfRequest,
  ReportPdfResponse,
} from "./reportPdfProtocol";

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
  private pending = new Map<
    number,
    { resolve: (blob: Blob) => void; reject: (error: Error) => void }
  >();

  render(request: ReportPdfRequest): Promise<Blob> {
    const worker = this.getWorker();
    const id = this.nextId++;
    return new Promise<Blob>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const message: ReportPdfMessage = { id, request };
      worker.postMessage(message);
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
