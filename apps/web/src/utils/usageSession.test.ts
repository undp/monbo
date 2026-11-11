import { describe, expect, it, vi } from "vitest";
import { readUsageSession, resetUsageSessionForTests, usageHeaders } from "./usageSession";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("usage session", () => {
  it("is a random UUID kept in sessionStorage for the tab", () => {
    const session = readUsageSession();
    expect(session).toMatch(UUID_V4);
    expect(sessionStorage.getItem("monbo.usageSession")).toBe(session);
    // A reload (or a remount) reads the same storage
    resetUsageSessionForTests();
    expect(readUsageSession()).toBe(session);
  });

  it("changes with a new tab's storage", () => {
    const first = readUsageSession();
    sessionStorage.clear();
    expect(readUsageSession()).not.toBe(first);
  });

  it("lives in memory when sessionStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const session = readUsageSession();
    expect(session).toMatch(UUID_V4);
    expect(readUsageSession()).toBe(session);
    vi.restoreAllMocks();
  });

  it("works without crypto.randomUUID (insecure contexts)", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      expect(readUsageSession()).toMatch(UUID_V4);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });

  it("doesn't change with the selected country", () => {
    const session = readUsageSession();
    expect(usageHeaders("CR")["X-Monbo-Session"]).toBe(session);
    expect(usageHeaders("PE")["X-Monbo-Session"]).toBe(session);
  });
});

describe("usageHeaders", () => {
  it("sends the session, the country and the module", () => {
    expect(usageHeaders("CR", "deforestation-analysis")).toEqual({
      "X-Monbo-Session": readUsageSession(),
      "X-Monbo-Country": "CR",
      "X-Monbo-Module": "deforestation-analysis",
    });
  });

  it("leaves out an unknown country and module", () => {
    expect(usageHeaders(null)).toEqual({ "X-Monbo-Session": readUsageSession() });
  });
});
