"use client";

import { useCallback, useContext, useMemo } from "react";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { useAnalysedLayers } from "@/hooks/useAnalysedLayers";
import type { MapData } from "@/interfaces/LayerAnalysis";
import { FlowSection } from "@/components/page/flow/FlowSection";
import { LayerCategoryPicker } from "@/components/page/territorialAnalysis/LayerCategoryPicker";

/** The report's layers: the analysed ones, by category, in one column. */
export const ReportLayerPicker: React.FC = () => {
  const { t } = useTranslation();
  const layers = useAnalysedLayers();
  const {
    reportGenerationParams: { selectedMaps },
    setReportGenerationParams,
    availableCategories,
  } = useContext(DataContext);
  const selectedIds = useMemo(
    () => new Set(selectedMaps.map(({ id }) => id)),
    [selectedMaps]
  );

  const onChange = useCallback(
    (layer: MapData, checked: boolean) =>
      setReportGenerationParams((prev) => {
        const ids = new Set(prev.selectedMaps.map(({ id }) => id));
        if (checked) ids.add(layer.id);
        else ids.delete(layer.id);
        // In the analysis's order, as the report lists them
        return { ...prev, selectedMaps: layers.filter(({ id }) => ids.has(id)) };
      }),
    [setReportGenerationParams, layers]
  );

  return (
    <FlowSection
      title={t("reportGeneration:sidebar.layersTitle")}
      subtitle={t("reportGeneration:sidebar.layersSubtitle", {
        selected: selectedMaps.length,
        total: layers.length,
      })}
      icon={<LayersOutlinedIcon fontSize="small" />}
      sx={{ padding: { xs: 2, md: "18px 18px" } }}
    >
      <LayerCategoryPicker
        layers={layers}
        categories={availableCategories}
        selectedIds={selectedIds}
        onChange={onChange}
        columns={1}
      />
    </FlowSection>
  );
};
