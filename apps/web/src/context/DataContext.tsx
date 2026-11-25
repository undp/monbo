"use client";

import {
  createContext,
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ValidateFarmsResponse } from "@/interfaces/PolygonValidation";
import { FarmData } from "@/interfaces/Farm";
import type { UploadSource } from "@/utils/uploadSources";
import {
  LayerAnalysisMapResults,
  MapData,
} from "@/interfaces/LayerAnalysis";
import { getMaps } from "@/api/layerAnalysis";
import { getLayerCategories } from "@/api/layerCategories";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import { getCountries } from "@/api/countries";
import i18nConfig from "@/i18nConfig";
import {
  layerTextsOf,
  replaceById,
  withLayerTexts,
  type LayerTexts,
} from "@/utils/layerTexts";
import { orderBy } from "lodash";
import {
  AVAILABLE_MAPS_POLLING_INTERVAL,
  ON_DEMAND_REFRESH_MIN_GAP,
} from "@/config/constants";

/**
 * What the stage 2 page is editing: the polygon subset and the layers (by id) of
 * the next analysis. Kept apart from `territorialAnalysisParams`, which is what
 * the current results were analysed with: editing never changes the results or the
 * report until "Analizar" runs a new analysis.
 */
export interface AnalysisDraft {
  polygonsSubset: "all" | "valid";
  selectedMapIds: number[];
}

export interface DataContextValue {
  farmsData: FarmData[] | null;
  setFarmsData: Dispatch<SetStateAction<DataContextValue["farmsData"]>>;
  polygonsValidationResults: ValidateFarmsResponse | null;
  setPolygonsValidationResults: Dispatch<
    SetStateAction<DataContextValue["polygonsValidationResults"]>
  >;
  /** The subset and layers the current results were analysed with. */
  territorialAnalysisParams: {
    polygonsSubset: "all" | "valid" | null;
    selectedMaps: MapData[];
  };
  setTerritorialAnalysisParams: Dispatch<
    SetStateAction<DataContextValue["territorialAnalysisParams"]>
  >;
  /** The stage 2 page's choices for the next analysis; null until edited. */
  analysisDraft: AnalysisDraft | null;
  setAnalysisDraft: Dispatch<SetStateAction<AnalysisDraft | null>>;
  territorialAnalysisResults: LayerAnalysisMapResults[] | null;
  setTerritorialAnalysisResults: Dispatch<
    SetStateAction<DataContextValue["territorialAnalysisResults"]>
  >;
  analysisOutdated: boolean;
  setAnalysisOutdated: Dispatch<SetStateAction<boolean>>;
  /** Drop results computed on a layer that changed since, and ask for a re-run. */
  invalidateAnalysis: () => void;
  reportGenerationParams: {
    /**
     * The report page set its defaults (every farm and analysed layer) for the
     * current analysis. Dropped with the choices, so the next visit sets them again.
     */
    seeded: boolean;
    selectedMaps: MapData[];
    selectedFarms: FarmData[];
    downloadType: "combined" | "separated" | null;
  };
  setReportGenerationParams: Dispatch<
    SetStateAction<DataContextValue["reportGenerationParams"]>
  >;
  availableMaps: MapData[];
  // The selected country's layer categories (`GET /categories`), fetched with its
  // layers: a layer is never listed without the categories of its own country.
  availableCategories: LayerCategory[];
  // The selected country's layers could not be fetched (and none arrived yet)
  availableMapsError: boolean;
  setAvailableMaps: Dispatch<SetStateAction<MapData[]>>;
  // Refetches the selected country's layers unless they were fetched less than
  // ON_DEMAND_REFRESH_MIN_GAP ago (or are being fetched). For layer selectors.
  refreshAvailableMaps: () => void;
  // The countries that can be analyzed (`GET /countries`), by ISO code.
  availableCountries: string[];
  // True once the first `GET /countries` has answered.
  availableCountriesLoaded: boolean;
  // True when the last `GET /countries` failed.
  availableCountriesError: boolean;
  // ISO 3166-1 alpha-2 code of the analysis country, kept for the tab session.
  selectedCountry: string | null;
  setSelectedCountry: (code: string | null) => void;
  // False until `selectedCountry` has been read from sessionStorage.
  countryHydrated: boolean;
  /** The flow's upload list: both stages' upload pages show and edit it, so it
   * is still there when the user comes back to add or remove polygons. */
  uploadSources: UploadSource[];
  setUploadSources: Dispatch<SetStateAction<UploadSource[]>>;
  /** Goes up on every change to `uploadSources`. */
  uploadSourcesRevision: number;
  /** The `uploadSourcesRevision` the loaded farms were parsed from; null when
   * they came from no list. Equal to it: the list didn't change since. */
  farmsSourcesRevision: number | null;
  setFarmsSourcesRevision: Dispatch<SetStateAction<number | null>>;
  // Drops the loaded farms, every result and the analysis and report params.
  resetAnalysis: () => void;
}

const SELECTED_COUNTRY_STORAGE_KEY = "monbo.selectedCountry";
// The country multi-select this app used before the country-first flow.
const LEGACY_SELECTED_COUNTRIES_STORAGE_KEY =
  "deforestationAnalysis.selectedCountries";

// The selected country lives in sessionStorage (in memory if it is unavailable),
// read through useSyncExternalStore: null while server rendering, then the
// stored value once hydrated.
let inMemorySelectedCountry: string | null = null;
const selectedCountryListeners = new Set<() => void>();

const subscribeToSelectedCountry = (listener: () => void) => {
  selectedCountryListeners.add(listener);
  return () => {
    selectedCountryListeners.delete(listener);
  };
};

// Goes up every time the flow is reset, so a request started before a reset
// (e.g. a file still being parsed when the user starts over) can tell that its
// response no longer belongs to the current flow.
let flowGeneration = 0;
export const readFlowGeneration = () => flowGeneration;

export const readSelectedCountry = () => {
  try {
    return sessionStorage.getItem(SELECTED_COUNTRY_STORAGE_KEY);
  } catch {
    return inMemorySelectedCountry;
  }
};

const writeSelectedCountry = (code: string | null) => {
  inMemorySelectedCountry = code;
  try {
    if (code) sessionStorage.setItem(SELECTED_COUNTRY_STORAGE_KEY, code);
    else sessionStorage.removeItem(SELECTED_COUNTRY_STORAGE_KEY);
  } catch (error) {
    console.error("Error storing the selected country:", error);
  }
  selectedCountryListeners.forEach((listener) => listener());
};

const initialTerritorialAnalysisParams: DataContextValue["territorialAnalysisParams"] =
  {
    polygonsSubset: "valid",
    selectedMaps: [],
  };

/** No report choice: the report page sets its defaults on its next visit. */
export const initialReportGenerationParams: DataContextValue["reportGenerationParams"] =
  {
    seeded: false,
    selectedMaps: [],
    selectedFarms: [],
    downloadType: null,
  };

export const DataContext = createContext<DataContextValue>({
  farmsData: null,
  setFarmsData: () => {},
  polygonsValidationResults: null,
  setPolygonsValidationResults: () => {},
  territorialAnalysisParams: initialTerritorialAnalysisParams,
  setTerritorialAnalysisParams: () => {},
  analysisDraft: null,
  setAnalysisDraft: () => {},
  territorialAnalysisResults: null,
  setTerritorialAnalysisResults: () => {},
  analysisOutdated: false,
  setAnalysisOutdated: () => {},
  invalidateAnalysis: () => {},
  reportGenerationParams: initialReportGenerationParams,
  setReportGenerationParams: () => {},
  availableMaps: [],
  availableCategories: [],
  availableMapsError: false,
  setAvailableMaps: () => {},
  refreshAvailableMaps: () => {},
  availableCountries: [],
  availableCountriesLoaded: false,
  availableCountriesError: false,
  selectedCountry: null,
  setSelectedCountry: () => {},
  countryHydrated: false,
  uploadSources: [],
  setUploadSources: () => {},
  uploadSourcesRevision: 0,
  farmsSourcesRevision: null,
  setFarmsSourcesRevision: () => {},
  resetAnalysis: () => {},
});

// The loaded flow, kept in memory outside the provider. Changing the language
// changes the root layout's `[locale]` segment, which remounts this provider on a
// client-side navigation; without this the farms and results would be lost and
// the pages would send the user back to /home. A full page reload still starts
// over.
type KeptKey =
  | "farmsData"
  | "polygonsValidationResults"
  | "territorialAnalysisParams"
  | "analysisDraft"
  | "territorialAnalysisResults"
  | "analysisOutdated"
  | "reportGenerationParams"
  | "uploadSources"
  | "uploadSourcesRevision"
  | "farmsSourcesRevision";
const keptState: Partial<Pick<DataContextValue, KeptKey>> = {};

// The texts of each layer seen in each UI language, so an analysed layer that is
// later hidden (and no longer listed by /maps) still reads in the current language.
const keptLayerTexts = new Map<string, LayerTexts>();
// `<language>:<country>` fetches in flight, so a language is fetched once.
const layerTextsFetches = new Set<string>();
const textsKey = (language: string, country: string, id: number) =>
  `${language}:${country}:${id}`;

/**
 * Forgets the module state above: the kept flow, the in-memory country and its
 * subscribers. For tests, so a flow doesn't leak from one to the next.
 * `flowGeneration` only goes up, so it is left as is.
 */
export const resetDataStoreForTests = () => {
  (Object.keys(keptState) as KeptKey[]).forEach((key) => delete keptState[key]);
  keptLayerTexts.clear();
  layerTextsFetches.clear();
  inMemorySelectedCountry = null;
  selectedCountryListeners.clear();
};

function useKeptState<K extends KeptKey>(
  key: K,
  initial: DataContextValue[K]
): [DataContextValue[K], Dispatch<SetStateAction<DataContextValue[K]>>] {
  const [value, setValue] = useState<DataContextValue[K]>(() =>
    key in keptState ? (keptState[key] as DataContextValue[K]) : initial
  );
  useEffect(() => {
    keptState[key] = value;
  }, [key, value]);
  return [value, setValue];
}

// On-demand refetches (returning to the tab, opening a layer selector) are
// skipped while the list is being fetched or was fetched less than
// ON_DEMAND_REFRESH_MIN_GAP ago.
const isRecent = ({ startedAt, inFlight }: { startedAt: number; inFlight: boolean }) =>
  inFlight || Date.now() - startedAt < ON_DEMAND_REFRESH_MIN_GAP;

const DataProvider: React.FC<{ children: React.ReactNode; locale: string }> = ({
  children,
  locale,
}) => {
  const [farmsData, setFarmsData] = useKeptState("farmsData", null);

  const [polygonsValidationResults, setPolygonsValidationResults] =
    useKeptState("polygonsValidationResults", null);

  const [territorialAnalysisParams, setTerritorialAnalysisParams] =
    useKeptState(
      "territorialAnalysisParams",
      initialTerritorialAnalysisParams
    );

  const [analysisDraft, setAnalysisDraft] = useKeptState("analysisDraft", null);

  const [territorialAnalysisResults, setTerritorialAnalysisResults] =
    useKeptState("territorialAnalysisResults", null);
  const [analysisOutdated, setAnalysisOutdated] = useKeptState(
    "analysisOutdated",
    false
  );

  const [reportGenerationParams, setReportGenerationParams] = useKeptState(
    "reportGenerationParams",
    initialReportGenerationParams
  );

  const [uploadSources, setUploadSourcesState] = useKeptState(
    "uploadSources",
    []
  );
  const [uploadSourcesRevision, setUploadSourcesRevision] = useKeptState(
    "uploadSourcesRevision",
    0
  );
  // Every change to the list counts, even one that leaves it equal: confirming
  // it then re-parses it, which is the safe direction.
  const setUploadSources = useCallback<
    Dispatch<SetStateAction<UploadSource[]>>
  >(
    (action) => {
      setUploadSourcesState(action);
      setUploadSourcesRevision((revision) => revision + 1);
    },
    [setUploadSourcesState, setUploadSourcesRevision]
  );
  const [farmsSourcesRevision, setFarmsSourcesRevision] = useKeptState(
    "farmsSourcesRevision",
    null
  );

  const invalidateAnalysis = useCallback(() => {
    // The API results and report used previous calculation inputs. Hide them
    // before the map or its interpretation switches to the new values.
    setTerritorialAnalysisResults(null);
    setReportGenerationParams(initialReportGenerationParams);
    setAnalysisOutdated(true);
  }, [setTerritorialAnalysisResults, setReportGenerationParams, setAnalysisOutdated]);

  // TODO: fetch API for available maps
  const [availableMaps, setAvailableMaps] = useState<
    DataContextValue["availableMaps"]
  >([]);
  const [availableCategories, setAvailableCategories] = useState<
    LayerCategory[]
  >([]);
  // The country the current list belongs to, and the one whose fetch failed: a
  // list is only shown for its own country, and an error only while that
  // country has no list yet.
  const [availableMapsCountry, setAvailableMapsCountry] = useState<string | null>(
    null
  );
  const [availableMapsErrorCountry, setAvailableMapsErrorCountry] = useState<
    string | null
  >(null);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [availableCountriesLoaded, setAvailableCountriesLoaded] =
    useState(false);
  const [availableCountriesError, setAvailableCountriesError] = useState(false);

  const selectedCountry = useSyncExternalStore(
    subscribeToSelectedCountry,
    readSelectedCountry,
    () => null
  );
  const countryHydrated = useSyncExternalStore(
    subscribeToSelectedCountry,
    () => true,
    () => false
  );

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_SELECTED_COUNTRIES_STORAGE_KEY);
    } catch {
      // Nothing to clean up without localStorage.
    }
  }, []);

  const resetAnalysis = useCallback(() => {
    flowGeneration += 1;
    setFarmsData(null);
    setPolygonsValidationResults(null);
    setTerritorialAnalysisResults(null);
    setAnalysisOutdated(false);
    setTerritorialAnalysisParams(initialTerritorialAnalysisParams);
    setAnalysisDraft(null);
    setReportGenerationParams(initialReportGenerationParams);
    setUploadSources([]);
    setFarmsSourcesRevision(null);
  }, [
    setUploadSources,
    setFarmsSourcesRevision,
    setAnalysisDraft,
    setFarmsData,
    setPolygonsValidationResults,
    setTerritorialAnalysisResults,
    setAnalysisOutdated,
    setTerritorialAnalysisParams,
    setReportGenerationParams,
  ]);

  // The last polarity and `temporal` seen of each category of `country`. A
  // category missing from a poll (disabled) keeps its entry, so one that changes
  // while hidden still counts as changed when it comes back.
  const knownCategories = useRef({
    country: null as string | null,
    byId: new Map<string, Pick<LayerCategory, "polarity" | "temporal">>(),
  });

  // Read the current analysis state on each poll without restarting the timer.
  const onMapsLoaded = useEffectEvent(
    (maps: MapData[], categories: LayerCategory[], country: string) => {
      const known = knownCategories.current;
      if (known.country !== country) {
        known.country = country;
        known.byId = new Map();
      }
      // Categories whose reading of a result changed since the last poll: the
      // same value would now give the opposite finding, or another kind of one.
      const reinterpreted = new Set(
        categories
          .filter((category) => {
            const before = known.byId.get(category.id);
            return (
              before !== undefined &&
              (before.polarity !== category.polarity ||
                before.temporal !== category.temporal)
            );
          })
          .map((category) => category.id)
      );
      for (const { id, polarity, temporal } of categories) {
        known.byId.set(id, { polarity, temporal });
      }

      for (const map of maps) {
        keptLayerTexts.set(textsKey(locale, country, map.id), layerTextsOf(map));
      }
      setAvailableMaps(maps);
      setAvailableCategories(categories);
      setAvailableMapsCountry(country);
      setAvailableMapsErrorCountry(null);
      const selectedMaps = territorialAnalysisParams.selectedMaps;
      if (!selectedMaps.length) return;

      // Public /maps only returns enabled layers. A hidden layer keeps its last
      // metadata only while an existing analysis refers to it; otherwise it is
      // deselected, so a hidden layer is never used for a new analysis.
      const refreshed = selectedMaps.flatMap((selected) => {
        const listed = maps.find((map) => map.id === selected.id);
        if (listed) return [listed];
        const kept = keptLayerTexts.get(textsKey(locale, country, selected.id));
        return territorialAnalysisResults ? [withLayerTexts(selected, kept)] : [];
      });
      setReportGenerationParams((prev) => {
        const maps = replaceById(prev.selectedMaps, refreshed);
        return maps === prev.selectedMaps ? prev : { ...prev, selectedMaps: maps };
      });
      const calculationChanged =
        refreshed.length === selectedMaps.length &&
        refreshed.some(
          (map, index) =>
            map.version !== selectedMaps[index].version ||
            map.pixelSize !== selectedMaps[index].pixelSize ||
            map.baseline !== selectedMaps[index].baseline ||
            map.comparedAgainst !== selectedMaps[index].comparedAgainst ||
            map.categoryId !== selectedMaps[index].categoryId ||
            reinterpreted.has(map.categoryId)
        );

      if (calculationChanged && territorialAnalysisResults) {
        invalidateAnalysis();
      }

      if (
        refreshed.length !== selectedMaps.length ||
        refreshed.some((map, index) => map !== selectedMaps[index])
      ) {
        setTerritorialAnalysisParams((prev) => ({
          ...prev,
          selectedMaps: refreshed,
        }));
      }
    }
  );

  // Once an analysis has results, keep its layers' texts in every UI language: a
  // layer hidden later is no longer listed, and the exports and the report still
  // have to read in the language the user switches to.
  const keepLayerTexts = useEffectEvent(async () => {
    const country = selectedCountry;
    const analysed = territorialAnalysisParams.selectedMaps;
    if (!territorialAnalysisResults || !country || !analysed.length) return;
    for (const language of i18nConfig.locales) {
      if (language === locale) continue;
      const missing = analysed.some(
        (map) => !keptLayerTexts.has(textsKey(language, country, map.id))
      );
      if (!missing) continue;
      const fetchKey = `${language}:${country}`;
      if (layerTextsFetches.has(fetchKey)) continue;
      layerTextsFetches.add(fetchKey);
      try {
        for (const map of await getMaps(language, country)) {
          keptLayerTexts.set(textsKey(language, country, map.id), layerTextsOf(map));
        }
      } catch (error) {
        console.error(error);
      } finally {
        layerTextsFetches.delete(fetchKey);
      }
    }
  });

  useEffect(() => {
    keepLayerTexts();
  }, [territorialAnalysisResults, selectedCountry, locale]);

  // The latest fetch of each list. Every fetch takes the next request number and
  // its response is applied only while it is still the latest, so a late
  // response (for the previous country, or after a newer one) is dropped.
  const countriesFetch = useRef({ request: 0, startedAt: -Infinity, inFlight: false });
  const mapsFetch = useRef({
    request: 0,
    country: null as string | null,
    startedAt: -Infinity,
    inFlight: false,
  });

  const fetchAvailableCountries = useEffectEvent(async () => {
    const latest = countriesFetch.current;
    const request = ++latest.request;
    latest.startedAt = Date.now();
    latest.inFlight = true;
    let countries: { code: string }[];
    try {
      countries = await getCountries();
    } catch (error) {
      console.error(error);
      // Once a list has arrived, a failed refresh keeps it.
      if (request === latest.request) setAvailableCountriesError(true);
      return;
    } finally {
      if (request === latest.request) latest.inFlight = false;
    }
    if (request !== latest.request) return;
    setAvailableCountries(countries.map(({ code }) => code));
    setAvailableCountriesLoaded(true);
    setAvailableCountriesError(false);
  });

  const fetchAvailableMaps = useEffectEvent(async () => {
    // The layers are only needed once a country is chosen.
    if (!selectedCountry) return;
    const country = selectedCountry;
    const latest = mapsFetch.current;
    const request = ++latest.request;
    latest.country = country;
    latest.startedAt = Date.now();
    latest.inFlight = true;
    let maps: MapData[];
    let categories: LayerCategory[];
    try {
      // Both or neither: grouping layers without their categories would classify
      // them with no rule.
      [maps, categories] = await Promise.all([
        getMaps(locale, country),
        getLayerCategories(country),
      ]);
    } catch (error) {
      console.error(error);
      if (request === latest.request) setAvailableMapsErrorCountry(country);
      return;
    } finally {
      if (request === latest.request) latest.inFlight = false;
    }
    if (request !== latest.request) return;
    onMapsLoaded(maps, categories, country);
  });

  // On-demand refetches skip a list fetched recently; the poll and a country
  // change always fetch.
  const refreshAvailableCountriesOnDemand = useEffectEvent(() => {
    if (!isRecent(countriesFetch.current)) fetchAvailableCountries();
  });

  const refreshAvailableMapsOnDemand = useEffectEvent(() => {
    const latest = mapsFetch.current;
    if (latest.country === selectedCountry && isRecent(latest)) return;
    fetchAvailableMaps();
  });

  useEffect(() => {
    const latest = countriesFetch.current;
    const interval = setInterval(
      fetchAvailableCountries,
      AVAILABLE_MAPS_POLLING_INTERVAL
    );
    fetchAvailableCountries();
    return () => {
      // Drops the pending response.
      latest.request += 1;
      latest.inFlight = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selectedCountry) return;
    const latest = mapsFetch.current;
    const interval = setInterval(fetchAvailableMaps, AVAILABLE_MAPS_POLLING_INTERVAL);
    fetchAvailableMaps();
    return () => {
      // Drops the pending response: it is for the previous country or language.
      latest.request += 1;
      latest.inFlight = false;
      clearInterval(interval);
    };
  }, [locale, selectedCountry]);

  // A layer enabled while the user was on another tab or app shows up when they
  // come back, instead of on the next poll.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      refreshAvailableCountriesOnDemand();
      refreshAvailableMapsOnDemand();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // Layer selectors ask for a refresh through the context; the request is
  // counted in state so the refetch runs from an effect.
  const [mapsRefreshRequests, setMapsRefreshRequests] = useState(0);
  const refreshAvailableMaps = useCallback(
    () => setMapsRefreshRequests((count) => count + 1),
    []
  );
  useEffect(() => {
    if (mapsRefreshRequests > 0) refreshAvailableMapsOnDemand();
  }, [mapsRefreshRequests]);

  // A country kept from earlier in the tab session may have lost its layers
  // meanwhile: drop it once per mount, when the first country list arrives.
  // Later changes keep the selection (the layer lists then say no layers are
  // available). The provider also remounts on a language change with the flow
  // kept (keptState), so dropping the country clears that flow too: farms and
  // results of a country that is no longer selected must not stay loaded.
  const storedCountryChecked = useRef(false);
  useEffect(() => {
    if (storedCountryChecked.current || !countryHydrated) return;
    if (!availableCountriesLoaded) return;
    storedCountryChecked.current = true;
    if (selectedCountry && !availableCountries.includes(selectedCountry)) {
      writeSelectedCountry(null);
      resetAnalysis();
    }
  }, [
    countryHydrated,
    availableCountriesLoaded,
    availableCountries,
    selectedCountry,
    resetAnalysis,
  ]);

  const currentCountryMaps = useMemo(
    () => (availableMapsCountry === selectedCountry ? availableMaps : []),
    [availableMaps, availableMapsCountry, selectedCountry]
  );
  const currentCountryCategories = useMemo(
    () => (availableMapsCountry === selectedCountry ? availableCategories : []),
    [availableCategories, availableMapsCountry, selectedCountry]
  );

  const sortedTerritorialAnalysisParamsSelectedMaps = useMemo(
    () => orderBy(territorialAnalysisParams.selectedMaps, "id"),
    [territorialAnalysisParams.selectedMaps]
  );

  const currentState = useMemo(() => {
    return {
      farmsData,
      setFarmsData,
      polygonsValidationResults,
      setPolygonsValidationResults,
      territorialAnalysisParams: {
        ...territorialAnalysisParams,
        selectedMaps: sortedTerritorialAnalysisParamsSelectedMaps,
      },
      setTerritorialAnalysisParams,
      analysisDraft,
      setAnalysisDraft,
      territorialAnalysisResults,
      setTerritorialAnalysisResults,
      analysisOutdated,
      setAnalysisOutdated,
      invalidateAnalysis,
      reportGenerationParams,
      setReportGenerationParams,
      // Another country's list (still there right after a change) is never shown.
      availableMaps: currentCountryMaps,
      availableCategories: currentCountryCategories,
      availableMapsError:
        availableMapsErrorCountry === selectedCountry &&
        availableMapsCountry !== selectedCountry,
      setAvailableMaps,
      refreshAvailableMaps,
      availableCountries,
      availableCountriesLoaded,
      availableCountriesError,
      selectedCountry,
      setSelectedCountry: writeSelectedCountry,
      countryHydrated,
      uploadSources,
      setUploadSources,
      uploadSourcesRevision,
      farmsSourcesRevision,
      setFarmsSourcesRevision,
      resetAnalysis,
    };
  }, [
    farmsData,
    setFarmsData,
    polygonsValidationResults,
    setPolygonsValidationResults,
    territorialAnalysisParams,
    sortedTerritorialAnalysisParamsSelectedMaps,
    setTerritorialAnalysisParams,
    analysisDraft,
    setAnalysisDraft,
    territorialAnalysisResults,
    setTerritorialAnalysisResults,
    analysisOutdated,
    setAnalysisOutdated,
    invalidateAnalysis,
    reportGenerationParams,
    setReportGenerationParams,
    currentCountryMaps,
    currentCountryCategories,
    availableMapsCountry,
    availableMapsErrorCountry,
    setAvailableMaps,
    refreshAvailableMaps,
    availableCountries,
    availableCountriesLoaded,
    availableCountriesError,
    selectedCountry,
    countryHydrated,
    uploadSources,
    setUploadSources,
    uploadSourcesRevision,
    farmsSourcesRevision,
    setFarmsSourcesRevision,
    resetAnalysis,
  ]);

  return (
    <DataContext.Provider value={currentState}>{children}</DataContext.Provider>
  );
};

export default DataProvider;
