"use client";

import { DeforestationResultsTable as DeforestationResultsTableComponent } from "@/app/[locale]/deforestation-analysis/DeforestationResultsTable";
import { RowData } from "@/components/reusable/Table";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { FarmData } from "@/interfaces/Farm";
import { useCallback, useState } from "react";

export const DeforestationResultsTable: React.FC = () => {
  const { farmsData } = useVisibleDataForDeforestationPage();

  const [selectedRows, setSelectedRows] = useState<RowData<FarmData>[]>([]);

  const onAllRowsSelected = useCallback(
    (rows: RowData<FarmData>[]) => {
      setSelectedRows((prev) => (prev.length === farmsData.length ? [] : rows));
    },
    [farmsData.length]
  );

  const onRowSelected = useCallback((row: RowData<FarmData>) => {
    const rowValue = row.cells.id.value;
    setSelectedRows((prev) => {
      const isSelected = prev.some((r) => r.cells.id.value === rowValue);
      if (isSelected) {
        return prev.filter((r) => r.cells.id.value !== rowValue);
      }
      return [...prev, row];
    });
  }, []);

  const isRowSelected = useCallback(
    (row: RowData<FarmData>) =>
      selectedRows.some((r) => r.cells.id.value === row.cells.id.value),
    [selectedRows]
  );

  return (
    <DeforestationResultsTableComponent
      tableProps={{
        selectable: true,
        onAllRowsSelected,
        onRowSelected,
        isRowSelected,
        areAllSelected: selectedRows.length === farmsData.length,
      }}
    />
  );
};
