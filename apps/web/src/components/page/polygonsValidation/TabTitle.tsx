"use client";

import { DataContext } from "@/context/DataContext";
import { useContext } from "react";
import { sum } from "lodash";
import { useTranslation } from "react-i18next";
import { useValidFarmsDataForValidationPage } from "@/hooks/useValidFarmsDataForValidationPage";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";

interface TabTitleProps {
  type: "valid" | "inconsistent" | "error";
}

export const TabTitle: React.FC<TabTitleProps> = ({ type }) => {
  const { polygonsValidationResults } = useContext(DataContext);
  const { farmsData: validFarmsData } = useValidFarmsDataForValidationPage();

  const { t } = useTranslation();

  if (type === "valid") {
    return `${validFarmsData.length || 0} ${t(
      "polygonValidation:validPolygons"
    )}`;
  } else if (type === "inconsistent") {
    const polygonsAmount = sum(
      polygonsValidationResults?.inconsistencies?.map(
        ({ farmIds }) =>
          farmIds.filter(
            (farmId) =>
              polygonsValidationResults.farmResults.find(
                (f) => f.farmId === farmId
              )?.status === FarmValidationStatus.NOT_VALID
          ).length
      )
    );
    return `${polygonsAmount} ${t(
      polygonsAmount === 1
        ? "polygonValidation:inconsistentPolygons.singular"
        : "polygonValidation:inconsistentPolygons.plural"
    )}`;
  } else {
    return `${0} ${t("polygonValidation:errorPolygons")}`;
  }
};
