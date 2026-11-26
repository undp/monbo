import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCountries } from "@/api/countries";
import { getMaps } from "@/api/layerAnalysis";
import { getLayerCategories } from "@/api/layerCategories";
import {
  AVAILABLE_MAPS_POLLING_INTERVAL,
  ON_DEMAND_REFRESH_MIN_GAP,
} from "@/config/constants";
import type { MapData } from "@/interfaces/LayerAnalysis";
import { deferred } from "@/test/deferred";
import { createTestI18n } from "@/test/i18n";
import {
  makeCategory,
  makeFarm,
  makeFrontierCategory,
  makeMap,
  makeMapResults,
} from "@/test/factories";
import { renderWithDataProvider } from "@/test/renderWithDataProvider";
import { readFlowGeneration } from "./DataContext";

vi.mock("@/api/countries", () => ({ getCountries: vi.fn() }));
vi.mock("@/api/layerCategories", () => ({ getLayerCategories: vi.fn() }));
vi.mock("@/api/layerAnalysis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/layerAnalysis")>()),
  getMaps: vi.fn(),
}));

const COUNTRY_KEY = "monbo.selectedCountry";
const gfw = makeMap({ id: 1, name: "Global Forest Watch", alias: "GFW", version: 1 });
const tmf = makeMap({ id: 2, name: "TMF", alias: "TMF", availableCountriesCodes: ["PE"] });

/** Lets pending responses settle (fake timers: nothing else advances). */
const flush = () => act(() => vi.advanceTimersByTimeAsync(0));
/** The next poll of /countries and /maps. */
const poll = () => act(() => vi.advanceTimersByTimeAsync(AVAILABLE_MAPS_POLLING_INTERVAL));
/** Lets the minimum gap between on-demand refreshes pass (before the next poll). */
const passGap = () => act(() => vi.advanceTimersByTimeAsync(ON_DEMAND_REFRESH_MIN_GAP));

/** The user comes back to the tab: `visibilitychange` with the document `state`. */
const changeVisibility = (state: DocumentVisibilityState = "visible") => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
};

/** `/maps` answers each country's list from `lists` (CR: GFW, PE: TMF by default). */
const mapsByCountry = (lists: Record<string, MapData[]> = { CR: [gfw], PE: [tmf] }) =>
  vi.mocked(getMaps).mockImplementation(async (_language, country) => lists[country ?? ""] ?? []);

beforeEach(async () => {
  // Translations load with real timers (see createTestI18n).
  await createTestI18n("es");
  await createTestI18n("en");
  vi.useFakeTimers({
    // Date too: the minimum gap between on-demand refreshes reads Date.now().
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  });
  vi.mocked(getCountries).mockResolvedValue([{ code: "CR" }, { code: "PE" }]);
  mapsByCountry();
  vi.mocked(getLayerCategories).mockImplementation(async (country) =>
    country === "PE" ? [makeCategory(), makeFrontierCategory()] : [makeCategory()]
  );
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

  it("loads the country's categories with its layers", async () => {
    const { result } = await withCountry("CR");
    expect(getLayerCategories).toHaveBeenCalledWith("CR");
    expect(result.current.availableCategories).toEqual([makeCategory()]);

    act(() => result.current.setSelectedCountry("PE"));
    await flush();
    expect(result.current.availableMaps).toEqual([tmf]);
    expect(result.current.availableCategories).toEqual([
      makeCategory(),
      makeFrontierCategory(),
    ]);
  });

  it("shows no layers when the categories can't be loaded", async () => {
    vi.mocked(getLayerCategories).mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = await withCountry("CR");

    expect(result.current.availableMaps).toEqual([]);
    expect(result.current.availableCategories).toEqual([]);
    expect(result.current.availableMapsError).toBe(true);
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
      current.setTerritorialAnalysisParams({ polygonsSubset: "all", selectedMaps: [gfw] });
      if (withResults) {
        current.setTerritorialAnalysisResults([makeMapResults(1, { F01: 0.1 })]);
        current.setReportGenerationParams({
          seeded: true,
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

    expect(result.current.territorialAnalysisResults).toBeNull();
    expect(result.current.analysisOutdated).toBe(true);
    expect(result.current.reportGenerationParams).toMatchObject({
      seeded: false,
      selectedMaps: [],
      selectedFarms: [],
      downloadType: null,
    });
    expect(result.current.territorialAnalysisParams.selectedMaps).toEqual([changed]);
    expect(result.current.farmsData).toHaveLength(1);
  });

  it("invalidates the analysis when the layer moves to another category", async () => {
    const { result } = await withSelectedLayer(true);
    const moved = { ...gfw, categoryId: "agricultural_frontier" };
    mapsByCountry({ CR: [moved] });
    vi.mocked(getLayerCategories).mockResolvedValue([makeCategory(), makeFrontierCategory()]);

    await poll();

    expect(result.current.territorialAnalysisResults).toBeNull();
    expect(result.current.analysisOutdated).toBe(true);
    expect(result.current.territorialAnalysisParams.selectedMaps).toEqual([moved]);
  });

  it("invalidates the analysis when the layer's category flips its polarity", async () => {
    const { result } = await withSelectedLayer(true);
    vi.mocked(getLayerCategories).mockResolvedValue([makeCategory({ polarity: "required" })]);

    await poll();

    expect(result.current.territorialAnalysisResults).toBeNull();
    expect(result.current.analysisOutdated).toBe(true);
  });

  it("invalidates the analysis when the category comes back with another reading", async () => {
    const { result } = await withSelectedLayer(true);
    // The admin hides the layer and its category, then republishes both with the
    // category no longer temporal.
    mapsByCountry({ CR: [] });
    vi.mocked(getLayerCategories).mockResolvedValue([]);
    await poll();
    expect(result.current.territorialAnalysisResults).not.toBeNull();

    mapsByCountry({ CR: [gfw] });
    vi.mocked(getLayerCategories).mockResolvedValue([makeCategory({ temporal: false })]);
    await poll();

    expect(result.current.territorialAnalysisResults).toBeNull();
    expect(result.current.analysisOutdated).toBe(true);
  });

  it("keeps the analysis when only the category's threshold changes", async () => {
    const { result } = await withSelectedLayer(true);
    vi.mocked(getLayerCategories).mockResolvedValue([makeCategory({ thresholdPercentage: 5 })]);

    await poll();

    expect(result.current.territorialAnalysisResults).not.toBeNull();
    expect(result.current.analysisOutdated).toBe(false);
  });

  it("refreshes a renamed layer without invalidating", async () => {
    const { result } = await withSelectedLayer(true);
    mapsByCountry({ CR: [{ ...gfw, name: "GFW (Hansen)" }] });

    await poll();

    expect(result.current.territorialAnalysisResults).not.toBeNull();
    expect(result.current.analysisOutdated).toBe(false);
    expect(result.current.territorialAnalysisParams.selectedMaps[0].name).toBe(
      "GFW (Hansen)"
    );
  });

  it("keeps a hidden layer while an analysis uses it", async () => {
    const { result } = await withSelectedLayer(true);
    mapsByCountry({ CR: [] });

    await poll();

    expect(result.current.territorialAnalysisParams.selectedMaps).toEqual([gfw]);
    expect(result.current.territorialAnalysisResults).not.toBeNull();
  });

  it("invalidates the analysis on an on-demand refresh, as on a poll", async () => {
    const { result } = await withSelectedLayer(true);
    const changed = { ...gfw, version: 2 };
    mapsByCountry({ CR: [changed] });
    await passGap();

    act(() => result.current.refreshAvailableMaps());
    await flush();

    expect(result.current.territorialAnalysisResults).toBeNull();
    expect(result.current.analysisOutdated).toBe(true);
    expect(result.current.territorialAnalysisParams.selectedMaps).toEqual([changed]);
  });

  it("deselects a hidden layer without an analysis", async () => {
    const { result } = await withSelectedLayer(false);
    mapsByCountry({ CR: [] });

    await poll();

    expect(result.current.territorialAnalysisParams.selectedMaps).toEqual([]);
  });
});

describe("DataProvider on-demand refresh", () => {
  const newLayer = makeMap({ id: 3, name: "MOCUPP", alias: "MOCUPP" });

  it("refreshes both lists when the user returns to the tab", async () => {
    const { result } = await withCountry("CR");
    vi.mocked(getCountries).mockClear();
    vi.mocked(getMaps).mockClear();
    mapsByCountry({ CR: [gfw, newLayer] });
    await passGap();

    changeVisibility();
    await flush();

    expect(getCountries).toHaveBeenCalledTimes(1);
    expect(getMaps).toHaveBeenCalledTimes(1);
    expect(result.current.availableMaps).toEqual([gfw, newLayer]);
  });

  it("sends one request per list when visibility and focus fire together", async () => {
    await withCountry("CR");
    vi.mocked(getCountries).mockClear();
    vi.mocked(getMaps).mockClear();
    await passGap();

    changeVisibility();
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await flush();

    expect(getCountries).toHaveBeenCalledTimes(1);
    expect(getMaps).toHaveBeenCalledTimes(1);
  });

  it("does not refresh when the tab is hidden", async () => {
    await withCountry("CR");
    vi.mocked(getCountries).mockClear();
    vi.mocked(getMaps).mockClear();
    await passGap();

    changeVisibility("hidden");
    await flush();

    expect(getCountries).not.toHaveBeenCalled();
    expect(getMaps).not.toHaveBeenCalled();
  });

  it("skips a layers refresh within the minimum gap", async () => {
    const { result } = await withCountry("CR");
    vi.mocked(getMaps).mockClear();

    act(() => result.current.refreshAvailableMaps());
    await flush();

    expect(getMaps).not.toHaveBeenCalled();
  });

  it("skips a layers refresh while one is in flight", async () => {
    const { result } = await withCountry("CR");
    await passGap();
    vi.mocked(getMaps).mockClear();
    const pending = deferred<MapData[]>();
    vi.mocked(getMaps).mockReturnValue(pending.promise);

    act(() => result.current.refreshAvailableMaps());
    await flush();
    // Past the gap again, but the first refresh hasn't answered yet.
    await passGap();
    act(() => result.current.refreshAvailableMaps());
    await flush();
    expect(getMaps).toHaveBeenCalledTimes(1);

    pending.resolve([gfw, newLayer]);
    await flush();
    expect(result.current.availableMaps).toEqual([gfw, newLayer]);
  });

  it("does nothing without a selected country", async () => {
    const { result } = await renderWithDataProvider();
    await flush();

    act(() => result.current.refreshAvailableMaps());
    await flush();

    expect(getMaps).not.toHaveBeenCalled();
  });
});

describe("DataProvider layer texts across a language change", () => {
  const layerEs = makeMap({ id: 1, alias: "GFW es", source: "Fuente ES", version: 1 });
  const layerEn = { ...layerEs, alias: "GFW en", source: "Source EN" };
  const areasEs = makeMap({ id: 2, alias: "Áreas test", source: "Fuente ES", version: 4 });
  const areasEn = { ...areasEs, alias: "Test areas", source: "Source EN" };

  /** `/maps` answers each language's list from `lists`; a language not in it fails. */
  const mapsByLanguage = (lists: Partial<Record<"es" | "en", MapData[]>>) =>
    vi.mocked(getMaps).mockImplementation(async (language) => {
      const list = lists[language as "es" | "en"];
      if (!list) throw new Error("offline");
      return list;
    });

  /** CR selected and `maps` analysed in `es`, with results and a report choice. */
  const analysedInEs = async (maps: MapData[]) => {
    const provider = await withCountry("CR");
    const farm = makeFarm();
    act(() => {
      const { current } = provider.result;
      current.setFarmsData([farm]);
      current.setTerritorialAnalysisParams({ polygonsSubset: "all", selectedMaps: maps });
      current.setTerritorialAnalysisResults(
        maps.map(({ id }) => makeMapResults(id, { F01: 0.1 }))
      );
      current.setReportGenerationParams({
        seeded: true,
        selectedMaps: maps,
        selectedFarms: [farm],
        downloadType: "combined",
      });
    });
    await flush();
    return provider;
  };

  const englishCalls = () =>
    vi.mocked(getMaps).mock.calls.filter(([language]) => language === "en");

  it("refreshes the report's layers with the new language, keeping its choice", async () => {
    mapsByLanguage({ es: [layerEs], en: [layerEn] });
    const provider = await analysedInEs([layerEs]);

    await provider.remount("en");
    await flush();

    const { result } = provider;
    expect(result.current.reportGenerationParams.selectedMaps[0].alias).toBe("GFW en");
    expect(result.current.reportGenerationParams.seeded).toBe(true);
    expect(result.current.territorialAnalysisParams.selectedMaps[0].alias).toBe("GFW en");
  });

  it("shows a hidden layer's texts in the new language, keeping its analysis", async () => {
    mapsByLanguage({ es: [layerEs, areasEs], en: [layerEn, areasEn] });
    const provider = await analysedInEs([layerEs, areasEs]);
    mapsByLanguage({ es: [layerEs], en: [layerEn] });
    await poll();

    await provider.remount("en");
    await flush();

    const { result } = provider;
    const hidden = result.current.territorialAnalysisParams.selectedMaps.find(
      ({ id }) => id === 2
    );
    expect(hidden).toMatchObject({
      alias: "Test areas",
      source: "Source EN",
      version: 4,
      categoryId: areasEs.categoryId,
    });
    expect(result.current.territorialAnalysisResults).toHaveLength(2);
    expect(result.current.analysisOutdated).toBe(false);
    expect(
      result.current.reportGenerationParams.selectedMaps.find(({ id }) => id === 2)?.alias
    ).toBe("Test areas");
  });

  it("fetches the other language once while its texts are kept", async () => {
    mapsByLanguage({ es: [layerEs], en: [layerEn] });
    const provider = await analysedInEs([layerEs]);
    expect(englishCalls()).toEqual([["en", "CR"]]);

    await poll();
    await provider.remount("en");
    await flush();
    await provider.remount("es");
    await flush();

    // Only the provider mounted in `en` asks for its own list.
    expect(englishCalls()).toEqual([
      ["en", "CR"],
      ["en", "CR"],
    ]);
  });

  it("keeps a hidden layer's last texts when the other language can't be fetched", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mapsByLanguage({ es: [layerEs, areasEs] });
    const provider = await analysedInEs([layerEs, areasEs]);
    mapsByLanguage({ es: [layerEs], en: [layerEn] });
    await poll();

    await provider.remount("en");
    await flush();

    const hidden = provider.result.current.territorialAnalysisParams.selectedMaps.find(
      ({ id }) => id === 2
    );
    expect(hidden).toMatchObject({ alias: "Áreas test", source: "Fuente ES" });
    expect(provider.result.current.territorialAnalysisResults).toHaveLength(2);
  });
});

describe("DataProvider analysis flow", () => {
  it("starts over on resetAnalysis", async () => {
    const { result } = await withCountry("CR");
    act(() => {
      result.current.setFarmsData([makeFarm()]);
      result.current.setTerritorialAnalysisResults([makeMapResults(1, { F01: 0 })]);
      result.current.setAnalysisOutdated(true);
    });
    const generation = readFlowGeneration();

    act(() => result.current.resetAnalysis());

    expect(result.current).toMatchObject({
      farmsData: null,
      polygonsValidationResults: null,
      territorialAnalysisResults: null,
      analysisOutdated: false,
      territorialAnalysisParams: { polygonsSubset: "valid", selectedMaps: [] },
      reportGenerationParams: {
        seeded: false,
        selectedMaps: [],
        selectedFarms: [],
        downloadType: null,
      },
    });
    expect(readFlowGeneration()).toBe(generation + 1);
    // The country is not part of the flow.
    expect(result.current.selectedCountry).toBe("CR");
  });

  it("keeps the farms when an analysis is invalidated", async () => {
    const { result } = await withCountry("CR");
    act(() => {
      result.current.setFarmsData([makeFarm()]);
      result.current.setTerritorialAnalysisResults([makeMapResults(1, { F01: 0 })]);
    });

    act(() => result.current.invalidateAnalysis());

    expect(result.current.farmsData).toHaveLength(1);
    expect(result.current.territorialAnalysisResults).toBeNull();
    expect(result.current.analysisOutdated).toBe(true);
  });

  it("returns the selected layers sorted by id", async () => {
    const { result } = await withCountry("CR");

    act(() =>
      result.current.setTerritorialAnalysisParams({
        polygonsSubset: "all",
        selectedMaps: [makeMap({ id: 3 }), makeMap({ id: 1 }), makeMap({ id: 2 })],
      })
    );

    expect(result.current.territorialAnalysisParams.selectedMaps.map(({ id }) => id)).toEqual([
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
