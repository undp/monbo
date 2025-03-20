import { DataContext } from "@/context/DataContext";
import { FarmData } from "@/interfaces/Farm";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import { useContext, useMemo } from "react";

type ReturnType = {
  farmsData: FarmData[];
};

export const useValidFarmsDataForValidationPage = (): ReturnType => {
  const { farmsData, polygonsValidationResults } = useContext(DataContext);

  const validFarmsData = useMemo(
    () =>
      farmsData?.filter(
        (f) =>
          polygonsValidationResults?.farmResults.find(
            ({ farmId }) => farmId === f.id
          )?.status !== FarmValidationStatus.NOT_VALID
      ) ?? [],
    [farmsData, polygonsValidationResults]
  );

  return {
    farmsData: validFarmsData,
  };
};
