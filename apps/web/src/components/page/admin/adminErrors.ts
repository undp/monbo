import { AdminApiError } from "@/api/adminLayers";

/** FastAPI 422 details as readable lines (the API's own English messages). */
export const describeValidationError = (error: AdminApiError) =>
  Array.isArray(error.detail)
    ? error.detail
        .map((d: { loc?: unknown[]; msg?: string }) =>
          [d.loc?.slice(1).join("."), d.msg].filter(Boolean).join(": ")
        )
        .join("; ")
    : null;

/**
 * The API's own reason for refusing a request: its message (the rules of GC-2 name
 * the layers involved) or the 422 details. Null when there is none to show. The UI
 * shows it after a translated sentence, for refusals it didn't foresee.
 */
export const apiRefusalReason = (error: unknown): string | null => {
  if (!(error instanceof AdminApiError)) return null;
  if (typeof error.detail === "string" && error.detail.trim()) return error.detail;
  if (error.status === 422) return describeValidationError(error);
  return null;
};
