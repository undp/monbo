"use client";

import {
  createContext,
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
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
  /** Drop results computed on a layer that changed since, and ask for a re-run. */
  invalidateAnalysis: () => void;
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
}

export const DataContext = createContext<DataContextValue>({
  farmsData: null,
  setFarmsData: () => {},
  polygonsValidationResults: null,
  setPolygonsValidationResults: () => {},
  deforestationAnalysisParams: {
    polygonsSubset: "valid",
    selectedMaps: [],
  },
  setDeforestationAnalysisParams: () => {},
  deforestationAnalysisResults: null,
  setDeforestationAnalysisResults: () => {},
  analysisOutdated: false,
  setAnalysisOutdated: () => {},
  invalidateAnalysis: () => {},
  reportGenerationParams: {
    initialFarmSelection: "all",
    selectedMaps: [],
    selectedFarms: [],
    downloadType: null,
  },
  setReportGenerationParams: () => {},
  availableMaps: [],
  setAvailableMaps: () => {},
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
    useState<DataContextValue["deforestationAnalysisParams"]>({
      polygonsSubset: "valid",
      selectedMaps: [],
    });

  const [deforestationAnalysisResults, setDeforestationAnalysisResults] =
    useState<DataContextValue["deforestationAnalysisResults"]>(null);
  const [analysisOutdated, setAnalysisOutdated] = useState(false);

  const [reportGenerationParams, setReportGenerationParams] = useState<
    DataContextValue["reportGenerationParams"]
  >({
    initialFarmSelection: "all",
    selectedMaps: [],
    selectedFarms: [],
    downloadType: null,
  });

  const invalidateAnalysis = useCallback(() => {
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
  }, []);

  // TODO: fetch API for available maps
  const [availableMaps, setAvailableMaps] = useState<
    DataContextValue["availableMaps"]
  >([]);

  // Read the current analysis state on each poll without restarting the timer.
  const onMapsLoaded = useEffectEvent((maps: MapData[]) => {
    setAvailableMaps(maps);
    const selectedMaps = deforestationAnalysisParams.selectedMaps;
    if (!selectedMaps.length) return;

    // Public /maps only returns enabled layers. A hidden layer keeps its last
    // metadata only while an existing analysis refers to it; otherwise it is
    // deselected, so a hidden layer is never used for a new analysis.
    const refreshed = selectedMaps.flatMap((selected) => {
      const listed = maps.find((map) => map.id === selected.id);
      if (listed) return [listed];
      return deforestationAnalysisResults ? [selected] : [];
    });
    const calculationChanged =
      refreshed.length === selectedMaps.length &&
      refreshed.some(
        (map, index) =>
          map.version !== selectedMaps[index].version ||
          map.pixelSize !== selectedMaps[index].pixelSize ||
          map.baseline !== selectedMaps[index].baseline ||
          map.comparedAgainst !== selectedMaps[index].comparedAgainst
      );

    if (calculationChanged && deforestationAnalysisResults) {
      invalidateAnalysis();
    }

    if (
      refreshed.length !== selectedMaps.length ||
      refreshed.some((map, index) => map !== selectedMaps[index])
    ) {
      setDeforestationAnalysisParams((prev) => ({
        ...prev,
        selectedMaps: refreshed,
      }));
    }
  });

  useEffect(() => {
    let active = true;
    const fetchAvailableMaps = async () => {
      const maps = await getMaps(locale);
      if (active) onMapsLoaded(maps);
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
      invalidateAnalysis,
      reportGenerationParams,
      setReportGenerationParams,
      availableMaps,
      setAvailableMaps,
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
    invalidateAnalysis,
    reportGenerationParams,
    setReportGenerationParams,
    availableMaps,
    setAvailableMaps,
  ]);

  return (
    <DataContext.Provider value={currentState}>{children}</DataContext.Provider>
  );
};

export default DataProvider;
