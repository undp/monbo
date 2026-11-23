import { request } from "./adminLayers";
import type { components } from "./schema";

export type UsageReport = components["schemas"]["UsageReport"];
export type UsageBlock = components["schemas"]["UsageBlock"];

/** Usage of the whole app, every country, for `[from, to]` (UTC days, included).
 * Throws an AdminApiError with status 503 when the API has no usage metrics. */
export const getAdminUsage = (token: string, from: string, to: string) =>
  request<UsageReport>(`/usage?${new URLSearchParams({ from, to })}`, { token });
