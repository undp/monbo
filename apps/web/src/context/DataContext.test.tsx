import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCountries } from "@/api/countries";
import { getMaps } from "@/api/deforestationAnalysis";
import { AVAILABLE_MAPS_POLLING_INTERVAL } from "@/config/constants";
import type { MapData } from "@/interfaces/DeforestationAnalysis";
import { deferred } from "@/test/deferred";
import { createTestI18n } from "@/test/i18n";
import { makeFarm, makeMap, makeMapResults } from "@/test/factories";
import { renderWithDataProvider } from "@/test/renderWithDataProvider";
import { readFlowGeneration } from "./DataContext";

vi.mock("@/api/countries", () => ({ getCountries: vi.fn() }));
vi.mock("@/api/deforestationAnalysis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/deforestationAnalysis")>()),
  getMaps: vi.fn(),
}));

const COUNTRY_KEY = "monbo.selectedCountry";
const gfw = makeMap({ id: 1, name: "Global Forest Watch", alias: "GFW", version: 1 });
const tmf = makeMap({ id: 2, name: "TMF", alias: "TMF", availableCountriesCodes: ["PE"] });

/** Lets pending responses settle (fake timers: nothing else advances). */
const flush = () => act(() => vi.advanceTimersByTimeAsync(0));
/** The next poll of /countries and /maps. */
const poll = () => act(() => vi.advanceTimersByTimeAsync(AVAILABLE_MAPS_POLLING_INTERVAL));

/** `/maps` answers each country's list from `lists` (CR: GFW, PE: TMF by default). */
const mapsByCountry = (lists: Record<string, MapData[]> = { CR: [gfw], PE: [tmf] }) =>
  vi.mocked(getMaps).mockImplementation(async (_language, country) => lists[country ?? ""] ?? []);

beforeEach(async () => {
  // Translations load with real timers (see createTestI18n).
  await createTestI18n("es");
  await createTestI18n("en");
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
  });
  vi.mocked(getCountries).mockResolvedValue([{ code: "CR" }, { code: "PE" }]);
  mapsByCountry();
});

/** A mounted provider with the countries loaded and `country` selected. */
const withCountry = async (country = "CR") => {
  const provider = await renderWithDataProvider();
  await flush();
  act(() => provider.result.current.setSelectedCountry(country));
  await flush();
  return provider;
};

describe("DataProvider countries", () => {
  it("loads the countries that can be analyzed", async () => {
    const { result } = await renderWithDataProvider();
    expect(result.current.availableCountriesLoaded).toBe(false);

    await flush();

    expect(result.current.availableCountries).toEqual(["CR", "PE"]);
    expect(result.current.availableCountriesLoaded).toBe(true);
    expect(result.current.availableCountriesError).toBe(false);
  });

  it("reports an error when the first request fails", async () => {
    vi.mocked(getCountries).mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = await renderWithDataProvider();
    await flush();

    expect(result.current.availableCountriesError).toBe(true);
    expect(result.current.availableCountriesLoaded).toBe(false);
  });

  it("keeps the list when a refresh fails", async () => {
    const { result } = await renderWithDataProvider();
    await flush();
    vi.mocked(getCountries).mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await poll();

    expect(result.current.availableCountries).toEqual(["CR", "PE"]);
    expect(result.current.availableCountriesLoaded).toBe(true);
  });
});

describe("DataProvider selected country", () => {
  it("keeps the country in the session storage", async () => {
    const { result } = await withCountry("PE");

    expect(result.current.selectedCountry).toBe("PE");
    expect(sessionStorage.getItem(COUNTRY_KEY)).toBe("PE");

    act(() => result.current.setSelectedCountry(null));

    expect(result.current.selectedCountry).toBeNull();
    expect(sessionStorage.getItem(COUNTRY_KEY)).toBeNull();
  });

  it("drops a stored country that lost its layers, and the flow with it, once per mount", async () => {
    sessionStorage.setItem(COUNTRY_KEY, "EC");
    const countries = deferred<{ code: string }[]>();
    vi.mocked(getCountries).mockReturnValue(countries.promise);
    const { result } = await renderWithDataProvider();
    expect(result.current.selectedCountry).toBe("EC");
    act(() => result.current.setFarmsData([makeFarm()]));

    countries.resolve([{ code: "CR" }]);
    await flush();

    expect(result.current.selectedCountry).toBeNull();
    expect(result.current.farmsData).toBeNull();

    // Later lists don't drop a selection: the layer lists say there are none.
    act(() => result.current.setSelectedCountry("EC"));
    vi.mocked(getCountries).mockResolvedValue([{ code: "CR" }]);
    await poll();
    expect(result.current.selectedCountry).toBe("EC");
  });

  it("removes the legacy multi-country selection", async () => {
    localStorage.setItem("deforestationAnalysis.selectedCountries", '["CR"]');

    await renderWithDataProvider();

    expect(localStorage.getItem("deforestationAnalysis.selectedCountries")).toBeNull();
  });
});

describe("DataProvider layers", () => {
  it("asks for layers only once a country is chosen, and polls them", async () => {
    const { result } = await renderWithDataProvider();
    await flush();
    expect(getMaps).not.toHaveBeenCalled();

    act(() => result.current.setSelectedCountry("CR"));
    await flush();

    expect(getMaps).toHaveBeenCalledWith("es", "CR");
    expect(result.current.availableMaps).toEqual([gfw]);

    await poll();
    expect(getMaps).toHaveBeenCalledTimes(2);
  });

  it("shows only the selected country's layers", async () => {
    const { result } = await withCountry("CR");
    const pe = deferred<MapData[]>();
    vi.mocked(getMaps).mockReturnValue(pe.promise);

    act(() => result.current.setSelectedCountry("PE"));
    await flush();
    expect(result.current.availableMaps).toEqual([]);

    pe.resolve([tmf]);
    await flush();
    expect(result.current.availableMaps).toEqual([tmf]);
  });

  it("reports a layers error only while the country has no list", async () => {
    vi.mocked(getMaps).mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = await withCountry("CR");

    expect(result.current.availableMapsError).toBe(true);

    mapsByCountry();
    await poll();
    expect(result.current.availableMapsError).toBe(false);
    expect(result.current.availableMaps).toEqual([gfw]);
  });

  it("ignores a response for the previous country", async () => {
    const cr = deferred<MapData[]>();
    vi.mocked(getMaps).mockReturnValueOnce(cr.promise);
    const { result } = await withCountry("CR");

    act(() => result.current.setSelectedCountry("PE"));
    await flush();
    cr.resolve([gfw]);
    await flush();

    expect(result.current.availableMaps).toEqual([tmf]);
  });
});

describe("DataProvider polling with a selected layer", () => {
  /** CR selected, GFW v1 chosen for the analysis, and `withResults` results. */
  const withSelectedLayer = async (withResults: boolean) => {
    const provider = await withCountry("CR");
    const farm = makeFarm();
    act(() => {
      const { current } = provider.result;
      current.setFarmsData([farm]);
      current.setDeforestationAnalysisParams({ polygonsSubset: "all", selectedMaps: [gfw] });
      if (withResults) {
        current.setDeforestationAnalysisResults([makeMapResults(1, { F01: 0.1 })]);
        current.setReportGenerationParams({
          initialFarmSelection: "select",
          selectedMaps: [gfw],
          selectedFarms: [farm],
          downloadType: "combined",
        });
      }
    });
    return provider;
  };

  it.each([
    ["version", { version: 2 }],
    ["pixel size", { pixelSize: 10 }],
    ["baseline", { baseline: 2021 }],
    ["comparison year", { comparedAgainst: 2024 }],
  ])("invalidates the analysis when the layer's %s changes", async (_, change) => {
    const { result } = await withSelectedLayer(true);
    const changed = { ...gfw, ...change };
    mapsByCountry({ CR: [changed] });

    await poll();

    expect(result.current.deforestationAnalysisResults).toBeNull();
    expect(result.current.analysisOutdated).toBe(true);
    expect(result.current.reportGenerationParams).toMatchObject({
      selectedMaps: [],
      selectedFarms: [],
      downloadType: null,
    });
    expect(result.current.deforestationAnalysisParams.selectedMaps).toEqual([changed]);
    expect(result.current.farmsData).toHaveLength(1);
  });

  it("refreshes a renamed layer without invalidating", async () => {
    const { result } = await withSelectedLayer(true);
    mapsByCountry({ CR: [{ ...gfw, name: "GFW (Hansen)" }] });

    await poll();

    expect(result.current.deforestationAnalysisResults).not.toBeNull();
    expect(result.current.analysisOutdated).toBe(false);
    expect(result.current.deforestationAnalysisParams.selectedMaps[0].name).toBe(
      "GFW (Hansen)"
    );
  });

  it("keeps a hidden layer while an analysis uses it", async () => {
    const { result } = await withSelectedLayer(true);
    mapsByCountry({ CR: [] });

    await poll();

    expect(result.current.deforestationAnalysisParams.selectedMaps).toEqual([gfw]);
    expect(result.current.deforestationAnalysisResults).not.toBeNull();
  });

  it("deselects a hidden layer without an analysis", async () => {
    const { result } = await withSelectedLayer(false);
    mapsByCountry({ CR: [] });

    await poll();

    expect(result.current.deforestationAnalysisParams.selectedMaps).toEqual([]);
  });
});

describe("DataProvider analysis flow", () => {
  it("starts over on resetAnalysis", async () => {
    const { result } = await withCountry("CR");
    act(() => {
      result.current.setFarmsData([makeFarm()]);
      result.current.setDeforestationAnalysisResults([makeMapResults(1, { F01: 0 })]);
      result.current.setAnalysisOutdated(true);
    });
    const generation = readFlowGeneration();

    act(() => result.current.resetAnalysis());

    expect(result.current).toMatchObject({
      farmsData: null,
      polygonsValidationResults: null,
      deforestationAnalysisResults: null,
      analysisOutdated: false,
      deforestationAnalysisParams: { polygonsSubset: "valid", selectedMaps: [] },
      reportGenerationParams: { selectedMaps: [], selectedFarms: [], downloadType: null },
    });
    expect(readFlowGeneration()).toBe(generation + 1);
    // The country is not part of the flow.
    expect(result.current.selectedCountry).toBe("CR");
  });

  it("keeps the farms when an analysis is invalidated", async () => {
    const { result } = await withCountry("CR");
    act(() => {
      result.current.setFarmsData([makeFarm()]);
      result.current.setDeforestationAnalysisResults([makeMapResults(1, { F01: 0 })]);
    });

    act(() => result.current.invalidateAnalysis());

    expect(result.current.farmsData).toHaveLength(1);
    expect(result.current.deforestationAnalysisResults).toBeNull();
    expect(result.current.analysisOutdated).toBe(true);
  });

  it("returns the selected layers sorted by id", async () => {
    const { result } = await withCountry("CR");

    act(() =>
      result.current.setDeforestationAnalysisParams({
        polygonsSubset: "all",
        selectedMaps: [makeMap({ id: 3 }), makeMap({ id: 1 }), makeMap({ id: 2 })],
      })
    );

    expect(result.current.deforestationAnalysisParams.selectedMaps.map(({ id }) => id)).toEqual([
      1, 2, 3,
    ]);
  });

  it("keeps the flow across a language change", async () => {
    const provider = await withCountry("CR");
    act(() => provider.result.current.setFarmsData([makeFarm()]));

    await provider.remount("en");
    await flush();

    expect(provider.result.current.farmsData).toHaveLength(1);
    expect(provider.result.current.selectedCountry).toBe("CR");
    expect(getMaps).toHaveBeenLastCalledWith("en", "CR");
  });

  it("loads a flow in one test…", async () => {
    const { result } = await withCountry("CR");
    act(() => result.current.setFarmsData([makeFarm()]));
    expect(result.current.farmsData).toHaveLength(1);
  });

  it("…and the next test's provider starts without it", async () => {
    const { result } = await renderWithDataProvider();

    expect(result.current.farmsData).toBeNull();
    expect(result.current.selectedCountry).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
