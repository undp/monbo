"use client";

import { DeforestationResultsTable as DeforestationResultsTableComponent } from "@/app/[locale]/deforestation-analysis/DeforestationResultsTable";
import { RowData } from "@/components/reusable/Table";
import { DataContext } from "@/context/DataContext";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { FarmData } from "@/interfaces/Farm";
import { useCallback, useContext } from "react";

export const DeforestationResultsTable: React.FC = () => {
  const { farmsData } = useVisibleDataForDeforestationPage();
  const {
    reportGenerationParams: {
      selectedMaps: selectedMapsForReport,
      selectedFarms: selectedFarmsForReport,
    },
    setReportGenerationParams,
  } = useContext(DataContext);

  const onAllRowsSelected = useCallback(() => {
    setReportGenerationParams((prev) => ({
      ...prev,
      selectedFarms:
        prev.selectedFarms.length === farmsData.length ? [] : farmsData,
    }));
  }, [setReportGenerationParams, farmsData]);

  const onRowSelected = useCallback(
    (row: RowData<FarmData>) => {
      const rowValue = row.cells.id.value;
      setReportGenerationParams((prev) => {
        const isSelected = prev.selectedFarms.some((r) => r.id === rowValue);
        if (isSelected) {
          return {
            ...prev,
            selectedFarms: prev.selectedFarms.filter((r) => r.id !== rowValue),
          };
        }
        const farmData = farmsData.find((r) => r.id === rowValue)!;
        return {
          ...prev,
          selectedFarms: [...prev.selectedFarms, farmData],
        };
      });
    },
    [setReportGenerationParams, farmsData]
  );

  const isRowSelected = useCallback(
    (row: RowData<FarmData>) =>
      selectedFarmsForReport.some(({ id }) => id === row.cells.id.value),
    [selectedFarmsForReport]
  );

  return (
    <DeforestationResultsTableComponent
      tableProps={{
        selectable: true,
        onAllRowsSelected,
        onRowSelected,
        isRowSelected,
        areAllSelected: selectedFarmsForReport.length === farmsData.length,
      }}
    />
  );
};
