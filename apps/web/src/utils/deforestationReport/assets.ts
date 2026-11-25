// Absolute, so the report's assets resolve the same in the window and in the PDF
// worker (src/workers/reportPdf.worker.tsx).
export const assetUrl = (path: string) =>
  new URL(path, globalThis.location.origin).href;
