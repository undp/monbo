import { describe, expect, it, vi } from "vitest";
import { useRouter } from "next/navigation";
import { saveAs } from "file-saver";
import {
  getDeforestationThreshold,
  setRuntimeConfig,
} from "@/config/runtime";
import { router } from "./navigation";

// The shared setup itself: if these fail, every other test is suspect.

describe("test setup", () => {
  it("rejects a request the test didn't stub, naming the URL", async () => {
    await expect(fetch("http://api.test/maps")).rejects.toThrow(
      "Unexpected request: http://api.test/maps"
    );
    // Forget the call, or the setup fails this test on purpose.
    vi.mocked(fetch).mockClear();
  });

  it("loads a runtime config for one test…", () => {
    setRuntimeConfig({
      deforestationThresholdPercentage: 1,
      overlapThresholdPercentage: 1,
    });
    expect(getDeforestationThreshold()).toBe(1);
  });

  it("…and the next test starts without it", () => {
    expect(() => getDeforestationThreshold()).toThrow(
      "Runtime config read before GET /config loaded"
    );
  });

  it("records navigation on the shared router", () => {
    useRouter().push("/home");
    expect(router.push).toHaveBeenCalledWith("/home");
  });

  it("replaces file saving with a spy", () => {
    saveAs(new Blob(["x"]), "farms.geojson");
    expect(saveAs).toHaveBeenCalledOnce();
  });

  it("writes to storage and fakes timers in one test…", () => {
    sessionStorage.setItem("monbo.selectedCountry", "CR");
    localStorage.setItem("key", "value");
    vi.useFakeTimers();
    expect(vi.isFakeTimers()).toBe(true);
  });

  it("…and the next test starts with empty storage and real timers", () => {
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
    expect(vi.isFakeTimers()).toBe(false);
  });
});
