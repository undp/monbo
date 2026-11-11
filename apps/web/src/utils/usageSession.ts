// The anonymous usage session: a random ID for the life of the tab, kept in
// sessionStorage next to the selected country (in memory if it is unavailable).
// It is not derived from the user or the device, is never a cookie and doesn't
// outlive the tab. The usage figures count these sessions, not people.

const USAGE_SESSION_STORAGE_KEY = "monbo.usageSession";

let inMemoryUsageSession: string | null = null;

/** The page the farms were uploaded from, sent with `/farms/parse`. */
export type UsageModule = "polygons-validation" | "deforestation-analysis";

// crypto.randomUUID only exists in secure contexts (HTTPS or localhost).
const randomUuid = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10).join(""),
  ].join("-");
};

/** The tab's session ID, created the first time it is needed. */
export const readUsageSession = (): string => {
  try {
    let session = sessionStorage.getItem(USAGE_SESSION_STORAGE_KEY);
    if (!session) {
      session = randomUuid();
      sessionStorage.setItem(USAGE_SESSION_STORAGE_KEY, session);
    }
    return session;
  } catch {
    inMemoryUsageSession ??= randomUuid();
    return inMemoryUsageSession;
  }
};

/** The usage context of an upload, validation or analysis request. */
export const usageHeaders = (
  country: string | null,
  module?: UsageModule
): Record<string, string> => ({
  "X-Monbo-Session": readUsageSession(),
  ...(country ? { "X-Monbo-Country": country } : {}),
  ...(module ? { "X-Monbo-Module": module } : {}),
});

/** Forgets the in-memory session. For tests. */
export const resetUsageSessionForTests = () => {
  inMemoryUsageSession = null;
};
