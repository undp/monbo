"use client";

import {
  createContext,
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
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

const readSelectedCountry = () => {
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
  reportGenerationParams: initialReportGenerationParams,
  setReportGenerationParams: () => {},
  availableMaps: [],
  setAvailableMaps: () => {},
  availableMapsLoaded: false,
  selectedCountry: null,
  setSelectedCountry: () => {},
  countryHydrated: false,
  resetAnalysis: () => {},
});

const DataProvider: React.FC<{ children: React.ReactNode; locale: string }> = ({
  children,
  locale,
}) => {
  const [farmsData, setFarmsData] =
    useState<DataContextValue["farmsData"]>(null);

  const [polygonsValidationResults, setPolygonsValidationResults] =
    useState<DataContextValue["polygonsValidationResults"]>(null);

  const [deforestationAnalysisParams, setDeforestationAnalysisParams] =
    useState<DataContextValue["deforestationAnalysisParams"]>(
      initialDeforestationAnalysisParams
    );

  const [deforestationAnalysisResults, setDeforestationAnalysisResults] =
    useState<DataContextValue["deforestationAnalysisResults"]>(null);

  const [reportGenerationParams, setReportGenerationParams] = useState<
    DataContextValue["reportGenerationParams"]
  >(initialReportGenerationParams);

  // TODO: fetch API for available maps
  const [availableMaps, setAvailableMaps] = useState<
    DataContextValue["availableMaps"]
  >([]);
  const [availableMapsLoaded, setAvailableMapsLoaded] = useState(false);

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
    setDeforestationAnalysisParams(initialDeforestationAnalysisParams);
    setReportGenerationParams(initialReportGenerationParams);
  }, []);

  useEffect(() => {
    const fetchAvailableMaps = async () => {
      const maps = await getMaps(locale);
      setAvailableMaps(maps);
      setAvailableMapsLoaded(true);
      // Keep already selected layers in step (language, and the raster version
      // used to bust the tile cache); a layer no longer listed keeps its data.
      setDeforestationAnalysisParams((prev) => ({
        ...prev,
        selectedMaps: prev.selectedMaps.map(
          (selected) => maps.find((map) => map.id === selected.id) ?? selected
        ),
      }));
    };
    const interval = setInterval(
      fetchAvailableMaps,
      AVAILABLE_MAPS_POLLING_INTERVAL
    );

    fetchAvailableMaps();
    return () => clearInterval(interval);
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
      reportGenerationParams,
      setReportGenerationParams,
      availableMaps,
      setAvailableMaps,
      availableMapsLoaded,
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
    reportGenerationParams,
    setReportGenerationParams,
    availableMaps,
    setAvailableMaps,
    availableMapsLoaded,
    selectedCountry,
    countryHydrated,
    resetAnalysis,
  ]);

  return (
    <DataContext.Provider value={currentState}>{children}</DataContext.Provider>
  );
};

export default DataProvider;
