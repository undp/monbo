"use client";

import { DeforestationResultsTable as DeforestationResultsTableComponent } from "@/components/page/deforestationAnalysis/DeforestationResultsTable";
import { RowData } from "@/components/reusable/Table";
import { DataContext } from "@/context/DataContext";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { FarmData } from "@/interfaces/Farm";
import { map } from "lodash";
import { startTransition, useCallback, useContext, useMemo } from "react";

export const DeforestationResultsTable: React.FC = () => {
  const { farmsData } = useVisibleDataForDeforestationPage();
  const {
    reportGenerationParams: {
      selectedMaps: selectedMapsForReport,
      selectedFarms: selectedFarmsForReport,
    },
    setReportGenerationParams,
  } = useContext(DataContext);

  const mapsSubset = useMemo(
    () => new Set(map(selectedMapsForReport, "id")),
    [selectedMapsForReport]
  );

  // Selection changes render as transitions: with 1000 rows, React re-renders the
  // checkboxes in slices and the page never blocks on a click.
  const onAllRowsSelected = useCallback(() => {
    startTransition(() =>
      setReportGenerationParams((prev) => ({
        ...prev,
        selectedFarms:
          prev.selectedFarms.length === farmsData.length ? [] : farmsData,
      }))
    );
  }, [setReportGenerationParams, farmsData]);

  // Lookups by id: with 1000 farms, a scan per row made each click O(n²).
  const farmsById = useMemo(
    () => new Map(farmsData.map((farm) => [farm.id, farm])),
    [farmsData]
  );
  const selectedIds = useMemo(
    () => new Set(selectedFarmsForReport.map(({ id }) => id)),
    [selectedFarmsForReport]
  );

  const onRowSelected = useCallback(
    (row: RowData<FarmData>) => {
      const rowValue = row.cells.id.value as string;
      startTransition(() =>
        setReportGenerationParams((prev) => {
          const isSelected = prev.selectedFarms.some((r) => r.id === rowValue);
          if (isSelected) {
            return {
              ...prev,
              selectedFarms: prev.selectedFarms.filter(
                (r) => r.id !== rowValue
              ),
            };
          }
          return {
            ...prev,
            selectedFarms: [...prev.selectedFarms, farmsById.get(rowValue)!],
          };
        })
      );
    },
    [setReportGenerationParams, farmsById]
  );

  const isRowSelected = useCallback(
    (row: RowData<FarmData>) => selectedIds.has(row.cells.id.value as string),
    [selectedIds]
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
      mapsSubset={mapsSubset}
    />
  );
};
