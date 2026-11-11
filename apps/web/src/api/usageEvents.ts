import { USAGE_EVENTS_URL } from "@/config/env";
import { readUsageSession } from "@/utils/usageSession";
import type { components } from "./schema";

type BrowserEventBody = components["schemas"]["BrowserEventBody"];

/** A report event, without the session and country, which are added here. */
export type UsageEvent = Omit<BrowserEventBody, "session" | "country">;

/**
 * Reports a usage event to the API, in the background: fire and forget. It never
 * throws and its failures are never shown to the user. `keepalive` lets it outlive
 * a page change, like a beacon, but with a JSON body.
 */
export const sendUsageEvent = (event: UsageEvent, country: string | null) => {
  try {
    const body: BrowserEventBody = {
      ...event,
      session: readUsageSession(),
      country,
    };
    fetch(USAGE_EVENTS_URL, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    // Usage events must never get in the user's way.
  }
};
