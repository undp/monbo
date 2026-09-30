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
import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import { getMaps } from "@/api/deforestationAnalysis";
import { orderBy } from "lodash";
import { AVAILABLE_MAPS_POLLING_INTERVAL } from "@/config/constants";
import { getLayersCountryCodes } from "@/utils/countries";

export interface DataContextValue {
  farmsData: FarmData[] | null;
  setFarmsData: Dispatch<SetStateAction<DataContextValue["farmsData"]>>;
  polygonsValidationResults: ValidateFarmsResponse | null;
  setPolygonsValidationResults: Dispatch<
    SetStateAction<DataContextValue["polygonsValidationResults"]>
  >;
  deforestationAnalysisParams: {
    polygonsSubset: "all" | "valid" | null;
    selectedMaps: MapData[];
  };
  setDeforestationAnalysisParams: Dispatch<
    SetStateAction<DataContextValue["deforestationAnalysisParams"]>
  >;
  deforestationAnalysisResults: DeforestationAnalysisMapResults[] | null;
  setDeforestationAnalysisResults: Dispatch<
    SetStateAction<DataContextValue["deforestationAnalysisResults"]>
  >;
  analysisOutdated: boolean;
  setAnalysisOutdated: Dispatch<SetStateAction<boolean>>;
  reportGenerationParams: {
    initialFarmSelection: "all" | "select";
    selectedMaps: MapData[];
    selectedFarms: FarmData[];
    downloadType: "combined" | "separated" | null;
  };
  setReportGenerationParams: Dispatch<
    SetStateAction<DataContextValue["reportGenerationParams"]>
  >;
  availableMaps: MapData[];
  setAvailableMaps: Dispatch<SetStateAction<MapData[]>>;
  // True once the first `GET /maps` has answered.
  availableMapsLoaded: boolean;
  // True when the last `GET /maps` failed.
  availableMapsError: boolean;
  // ISO 3166-1 alpha-2 code of the analysis country, kept for the tab session.
  selectedCountry: string | null;
  setSelectedCountry: (code: string | null) => void;
  // False until `selectedCountry` has been read from sessionStorage.
  countryHydrated: boolean;
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

const initialDeforestationAnalysisParams: DataContextValue["deforestationAnalysisParams"] =
  {
    polygonsSubset: "valid",
    selectedMaps: [],
  };

const initialReportGenerationParams: DataContextValue["reportGenerationParams"] =
  {
    initialFarmSelection: "all",
    selectedMaps: [],
    selectedFarms: [],
    downloadType: null,
  };

export const DataContext = createContext<DataContextValue>({
  farmsData: null,
  setFarmsData: () => {},
  polygonsValidationResults: null,
  setPolygonsValidationResults: () => {},
  deforestationAnalysisParams: initialDeforestationAnalysisParams,
  setDeforestationAnalysisParams: () => {},
  deforestationAnalysisResults: null,
  setDeforestationAnalysisResults: () => {},
  analysisOutdated: false,
  setAnalysisOutdated: () => {},
  reportGenerationParams: initialReportGenerationParams,
  setReportGenerationParams: () => {},
  availableMaps: [],
  setAvailableMaps: () => {},
  availableMapsLoaded: false,
  availableMapsError: false,
  selectedCountry: null,
  setSelectedCountry: () => {},
  countryHydrated: false,
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
  | "deforestationAnalysisParams"
  | "deforestationAnalysisResults"
  | "analysisOutdated"
  | "reportGenerationParams";
const keptState: Partial<Pick<DataContextValue, KeptKey>> = {};

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

const DataProvider: React.FC<{ children: React.ReactNode; locale: string }> = ({
  children,
  locale,
}) => {
  const [farmsData, setFarmsData] = useKeptState("farmsData", null);

  const [polygonsValidationResults, setPolygonsValidationResults] =
    useKeptState("polygonsValidationResults", null);

  const [deforestationAnalysisParams, setDeforestationAnalysisParams] =
    useKeptState(
      "deforestationAnalysisParams",
      initialDeforestationAnalysisParams
    );

  const [deforestationAnalysisResults, setDeforestationAnalysisResults] =
    useKeptState("deforestationAnalysisResults", null);
  const [analysisOutdated, setAnalysisOutdated] = useKeptState(
    "analysisOutdated",
    false
  );

  const [reportGenerationParams, setReportGenerationParams] = useKeptState(
    "reportGenerationParams",
    initialReportGenerationParams
  );

  // TODO: fetch API for available maps
  const [availableMaps, setAvailableMaps] = useState<
    DataContextValue["availableMaps"]
  >([]);
  const [availableMapsLoaded, setAvailableMapsLoaded] = useState(false);
  const [availableMapsError, setAvailableMapsError] = useState(false);

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
    setFarmsData(null);
    setPolygonsValidationResults(null);
    setDeforestationAnalysisResults(null);
    setAnalysisOutdated(false);
    setDeforestationAnalysisParams(initialDeforestationAnalysisParams);
    setReportGenerationParams(initialReportGenerationParams);
  }, [
    setFarmsData,
    setPolygonsValidationResults,
    setDeforestationAnalysisResults,
    setAnalysisOutdated,
    setDeforestationAnalysisParams,
    setReportGenerationParams,
  ]);

  // Read the current analysis state on each poll without restarting the timer.
  const onMapsLoaded = useEffectEvent((maps: MapData[]) => {
    setAvailableMaps(maps);
    const selectedMaps = deforestationAnalysisParams.selectedMaps;
    if (!selectedMaps.length) return;

    // A hidden layer keeps its last metadata so an existing analysis can still
    // refer to it; public /maps only returns enabled layers.
    const refreshed = selectedMaps.map(
      (selected) => maps.find((map) => map.id === selected.id) ?? selected
    );
    const calculationChanged = refreshed.some(
      (map, index) =>
        map.version !== selectedMaps[index].version ||
        map.pixelSize !== selectedMaps[index].pixelSize ||
        map.baseline !== selectedMaps[index].baseline ||
        map.comparedAgainst !== selectedMaps[index].comparedAgainst
    );

    if (calculationChanged && deforestationAnalysisResults) {
      // The API results and report used previous calculation inputs. Hide them
      // before the map or its interpretation switches to the new values.
      setDeforestationAnalysisResults(null);
      setReportGenerationParams((prev) => ({
        ...prev,
        selectedMaps: [],
        selectedFarms: [],
        downloadType: null,
      }));
      setAnalysisOutdated(true);
    }

    if (refreshed.some((map, index) => map !== selectedMaps[index])) {
      setDeforestationAnalysisParams((prev) => ({
        ...prev,
        selectedMaps: refreshed,
      }));
    }
  });

  useEffect(() => {
    let active = true;
    const fetchAvailableMaps = async () => {
      let maps: MapData[];
      try {
        maps = await getMaps(locale);
      } catch (error) {
        console.error(error);
        // Once a list has arrived, a failed refresh keeps it.
        if (active) setAvailableMapsError(true);
        return;
      }
      if (!active) return;
      setAvailableMapsLoaded(true);
      setAvailableMapsError(false);
      onMapsLoaded(maps);
    };
    const interval = setInterval(
      fetchAvailableMaps,
      AVAILABLE_MAPS_POLLING_INTERVAL
    );

    fetchAvailableMaps();
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [locale]);

  // A country kept from earlier in the tab session may have lost its layers
  // meanwhile: drop it once, when the first layer list arrives. Later changes
  // keep the selection (the layer lists then say no layers are available).
  const storedCountryChecked = useRef(false);
  useEffect(() => {
    if (storedCountryChecked.current || !countryHydrated) return;
    if (!availableMapsLoaded) return;
    storedCountryChecked.current = true;
    if (
      selectedCountry &&
      !getLayersCountryCodes(availableMaps).includes(selectedCountry)
    ) {
      writeSelectedCountry(null);
    }
  }, [countryHydrated, availableMapsLoaded, availableMaps, selectedCountry]);

  const sortedDeforestationAnalysisParamsSelectedMaps = useMemo(
    () => orderBy(deforestationAnalysisParams.selectedMaps, "id"),
    [deforestationAnalysisParams.selectedMaps]
  );

  const currentState = useMemo(() => {
    return {
      farmsData,
      setFarmsData,
      polygonsValidationResults,
      setPolygonsValidationResults,
      deforestationAnalysisParams: {
        ...deforestationAnalysisParams,
        selectedMaps: sortedDeforestationAnalysisParamsSelectedMaps,
      },
      setDeforestationAnalysisParams,
      deforestationAnalysisResults,
      setDeforestationAnalysisResults,
      analysisOutdated,
      setAnalysisOutdated,
      reportGenerationParams,
      setReportGenerationParams,
      availableMaps,
      setAvailableMaps,
      availableMapsLoaded,
      availableMapsError,
      selectedCountry,
      setSelectedCountry: writeSelectedCountry,
      countryHydrated,
      resetAnalysis,
    };
  }, [
    farmsData,
    setFarmsData,
    polygonsValidationResults,
    setPolygonsValidationResults,
    deforestationAnalysisParams,
    sortedDeforestationAnalysisParamsSelectedMaps,
    setDeforestationAnalysisParams,
    deforestationAnalysisResults,
    setDeforestationAnalysisResults,
    analysisOutdated,
    setAnalysisOutdated,
    reportGenerationParams,
    setReportGenerationParams,
    availableMaps,
    setAvailableMaps,
    availableMapsLoaded,
    availableMapsError,
    selectedCountry,
    countryHydrated,
    resetAnalysis,
  ]);

  return (
    <DataContext.Provider value={currentState}>{children}</DataContext.Provider>
  );
};

export default DataProvider;
