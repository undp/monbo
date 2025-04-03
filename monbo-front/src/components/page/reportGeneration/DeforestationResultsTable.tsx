"use client";

import { DeforestationResultsTable as DeforestationResultsTableComponent } from "@/app/[locale]/deforestation-analysis/DeforestationResultsTable";
import { RowData } from "@/components/reusable/Table";
import { DataContext } from "@/context/DataContext";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { FarmData } from "@/interfaces/Farm";
import { useCallback, useContext } from "react";

export const DeforestationResultsTable: React.FC = () => {
  const { farmsData } = useVisibleDataForDeforestationPage();
  const { selectedFarmsForReport, setSelectedFarmsForReport } =
    useContext(DataContext);

  const onAllRowsSelected = useCallback(() => {
    setSelectedFarmsForReport((prev) =>
      prev.length === farmsData.length ? [] : farmsData
    );
  }, [setSelectedFarmsForReport, farmsData]);

  const onRowSelected = useCallback(
    (row: RowData<FarmData>) => {
      const rowValue = row.cells.id.value;
      setSelectedFarmsForReport((prev) => {
        const isSelected = prev.some((r) => r.id === rowValue);
        if (isSelected) {
          return prev.filter((r) => r.id !== rowValue);
        }
        const farmData = farmsData.find((r) => r.id === rowValue)!;
        return [...prev, farmData];
      });
    },
    [setSelectedFarmsForReport, farmsData]
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
