import { describe, expect, it, vi } from "vitest";
import { sendUsageEvent } from "./usageEvents";
import { readUsageSession } from "@/utils/usageSession";

describe("sendUsageEvent", () => {
  it("posts the event with the session and country, in the background", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    sendUsageEvent({ type: "report_requested", outcome: "ok", farms: 5 }, "CR");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/events");
    expect(init).toMatchObject({ method: "POST", keepalive: true });
    expect(JSON.parse(init.body)).toEqual({
      type: "report_requested",
      outcome: "ok",
      farms: 5,
      session: readUsageSession(),
      country: "CR",
    });
  });

  it("swallows a failing request", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);

    expect(() =>
      sendUsageEvent({ type: "report_requested", outcome: "ok", farms: 1 }, null)
    ).not.toThrow();
    await Promise.resolve();
  });

  it("swallows a fetch that throws synchronously", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new TypeError("blocked");
      })
    );
    expect(() =>
      sendUsageEvent({ type: "report_requested", outcome: "ok", farms: 1 }, null)
    ).not.toThrow();
  });
});
