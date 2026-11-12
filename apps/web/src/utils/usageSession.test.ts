import { describe, expect, it, vi } from "vitest";
import { readUsageSession, resetUsageSessionForTests, usageHeaders } from "./usageSession";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The page goes away (reload, navigation, closed tab) and a new one loads with the
 * same storage. */
const reload = () => {
  window.dispatchEvent(new Event("pagehide"));
  resetUsageSessionForTests();
};

/** A tab opened from this one, or duplicated: a new page with a copy of the storage,
 * while this page is still open. */
const openCopiedTab = () => resetUsageSessionForTests();

describe("usage session", () => {
  it("is a random UUID kept in sessionStorage for the tab", () => {
    const session = readUsageSession();
    expect(session).toMatch(UUID_V4);
    expect(sessionStorage.getItem("monbo.usageSession")).toBe(session);
    reload();
    expect(readUsageSession()).toBe(session);
  });

  it("changes with a new tab's storage", () => {
    const first = readUsageSession();
    sessionStorage.clear();
    expect(readUsageSession()).not.toBe(first);
  });

  it("changes in a tab that starts with a copy of an open tab's storage", () => {
    const opener = readUsageSession();
    openCopiedTab();
    const copied = readUsageSession();
    expect(copied).toMatch(UUID_V4);
    expect(copied).not.toBe(opener);
    // The new tab keeps its own session across its reloads
    reload();
    expect(readUsageSession()).toBe(copied);
  });

  it("changes in a copied tab reloaded before it needed a session", () => {
    const opener = readUsageSession();
    openCopiedTab();
    reload();
    expect(readUsageSession()).not.toBe(opener);
  });

  it("is kept when the page comes back from the back-forward cache", () => {
    const session = readUsageSession();
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pageshow"));
    expect(readUsageSession()).toBe(session);
    // Still claimed by this page, so a tab copied from it gets its own
    openCopiedTab();
    expect(readUsageSession()).not.toBe(session);
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
