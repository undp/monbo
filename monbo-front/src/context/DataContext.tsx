"use client";

import {
  createContext,
  Dispatch,
  SetStateAction,
  useEffect,
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
  reportGenerationParams: {
    initialFarmSelection: "all" | "select";
    selectedMaps: MapData[];
    selectedFarms: FarmData[];
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
  reportGenerationParams: {
    initialFarmSelection: "all",
    selectedMaps: [],
    selectedFarms: [],
  },
  setReportGenerationParams: () => {},
  availableMaps: [],
  setAvailableMaps: () => {},
});

const DataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
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

  const [reportGenerationParams, setReportGenerationParams] = useState<
    DataContextValue["reportGenerationParams"]
  >({
    initialFarmSelection: "all",
    selectedMaps: [],
    selectedFarms: [],
  });

  // TODO: fetch API for available maps
  const [availableMaps, setAvailableMaps] = useState<
    DataContextValue["availableMaps"]
  >([]);

  useEffect(() => {
    const fetchAvailableMaps = async () => {
      const maps = await getMaps();
      setAvailableMaps(maps);
    };
    const interval = setInterval(
      fetchAvailableMaps,
      AVAILABLE_MAPS_POLLING_INTERVAL
    );

    fetchAvailableMaps();
    return () => clearInterval(interval);
  }, []);

  const currentState = useMemo(() => {
    return {
      farmsData,
      setFarmsData,
      polygonsValidationResults,
      setPolygonsValidationResults,
      deforestationAnalysisParams: {
        ...deforestationAnalysisParams,
        selectedMaps: orderBy(deforestationAnalysisParams.selectedMaps, "id"),
      },
      setDeforestationAnalysisParams,
      deforestationAnalysisResults,
      setDeforestationAnalysisResults,
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
    setDeforestationAnalysisParams,
    deforestationAnalysisResults,
    setDeforestationAnalysisResults,
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
