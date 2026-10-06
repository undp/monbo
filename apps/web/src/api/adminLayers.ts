import { ADMIN_API_URL } from "@/config/env";
import {
  AdminLayer,
  AdminSession,
  IngestionJob,
  LayerInput,
} from "@/interfaces/AdminLayer";

export class AdminApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
    public retryAfterSeconds: number | null = null
  ) {
    super(typeof detail === "string" ? detail : `Admin API error ${status}`);
  }
}

const toError = async (response: Response) => {
  let detail: unknown = response.statusText;
  try {
    detail = (await response.json()).detail;
  } catch {
    // not JSON
  }
  const retryAfter = Number(response.headers.get("Retry-After"));
  return new AdminApiError(
    response.status,
    detail,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null
  );
};

const request = async <T>(
  path: string,
  { token, method = "GET", body }: { token?: string; method?: string; body?: unknown }
): Promise<T> => {
  const response = await fetch(`${ADMIN_API_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw await toError(response);
  }
  return response.json();
};

export const createAdminSession = (passkey: string) =>
  request<AdminSession>("/session", { method: "POST", body: { passkey } });

export const getAdminSession = (token: string) =>
  request<{ expiresAt: string; country: string }>("/session", { token });

export const listAdminLayers = (token: string) =>
  request<AdminLayer[]>("/layers", { token });

export const createAdminLayer = (token: string, input: LayerInput) =>
  request<AdminLayer>("/layers", { token, method: "POST", body: input });

export const updateAdminLayer = (token: string, id: number, input: LayerInput) =>
  request<AdminLayer>(`/layers/${id}`, { token, method: "PUT", body: input });

export const setAdminLayerEnabled = (
  token: string,
  id: number,
  enabled: boolean
) =>
  request<AdminLayer>(`/layers/${id}`, {
    token,
    method: "PATCH",
    body: { enabled },
  });

export const getIngestionJob = (token: string, jobId: string) =>
  request<IngestionJob>(`/jobs/${jobId}`, { token });

/**
 * Asks a queued or running job to stop. "tooLate" when its raster is already
 * being activated (or the job ended): the caller should keep following it.
 */
export const cancelIngestionJob = async (
  token: string,
  jobId: string
): Promise<"cancelled" | "tooLate"> => {
  try {
    await request(`/jobs/${jobId}`, { token, method: "DELETE" });
    return "cancelled";
  } catch (e) {
    if (e instanceof AdminApiError && e.status === 409) return "tooLate";
    throw e;
  }
};

export const isAbortError = (e: unknown) =>
  e instanceof DOMException && e.name === "AbortError";

/**
 * Uploads a raster as the raw request body. XMLHttpRequest instead of fetch so
 * the upload progress can be shown.
 */
export const uploadLayerRaster = (
  token: string,
  id: number,
  file: File,
  {
    nodata,
    onProgress,
    signal,
  }: {
    nodata?: number | null;
    onProgress?: (fraction: number) => void;
    // Aborting rejects with an AbortError (see isAbortError)
    signal?: AbortSignal;
  } = {}
): Promise<{ jobId: string }> =>
  new Promise((resolve, reject) => {
    const query = nodata !== null && nodata !== undefined ? `?nodata=${nodata}` : "";
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${ADMIN_API_URL}/layers/${id}/raster${query}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type || "image/tiff");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body: { jobId?: string; detail?: unknown } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // not JSON
      }
      if (xhr.status === 202 && body.jobId) {
        resolve({ jobId: body.jobId });
      } else {
        reject(new AdminApiError(xhr.status, body.detail ?? xhr.statusText));
      }
    };
    xhr.onerror = () => reject(new AdminApiError(0, "Network error"));
    const aborted = () => new DOMException("Upload aborted", "AbortError");
    xhr.onabort = () => reject(aborted());
    if (signal?.aborted) {
      reject(aborted());
      return;
    }
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
