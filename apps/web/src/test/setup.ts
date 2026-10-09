import { afterEach, beforeEach, vi, type Mock } from "vitest";
import { cleanup } from "@testing-library/react";
import { resetRuntimeConfig } from "@/config/runtime";
import { resetNavigation } from "./navigation";

// Runs before every test file (vitest.config.ts `setupFiles`). Replaces the app's
// boundaries and resets module state, so each test passes alone or in any order.

vi.mock("next/navigation", async () => (await import("./navigation")).navigationMock);

vi.mock("file-saver", () => {
  const saveAs = vi.fn();
  return { saveAs, default: { saveAs } };
});

// No test reaches the network. A test that needs a response stubs `fetch` itself
// (vi.stubGlobal) or mocks the `@/api/*` module it goes through.
let unexpectedFetch: Mock<typeof fetch>;

beforeEach(() => {
  unexpectedFetch = vi.fn((input: RequestInfo | URL) =>
    Promise.reject(new Error(`Unexpected request: ${String(input)}`))
  );
  vi.stubGlobal("fetch", unexpectedFetch);
});

afterEach(async () => {
  // Fails the test even when the code under test swallowed the rejection.
  const urls = unexpectedFetch.mock.calls.map(([input]) => String(input));
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  resetRuntimeConfig();
  // Imported here, not at the top: an import from this file would load DataContext
  // (and the @/api modules it uses) before a test file's vi.mock could replace them.
  (await import("@/context/DataContext")).resetDataStoreForTests();
  sessionStorage.clear();
  localStorage.clear();
  resetNavigation();
  if (urls.length > 0) {
    throw new Error(`Unexpected request: ${urls.join(", ")}`);
  }
});
