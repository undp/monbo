"use client";

import { CircleObject, Map, PolygonObject } from "@/components/reusable/Map";
import { Box, Paper, Slide } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Text } from "@/components/reusable/Text";
import { formatArea } from "@/utils/polygons";
import { useTranslation } from "react-i18next";
import { LayerTilesOverlay } from "./LayerTilesOverlay";
import { useVisibleDataForAnalysisPage } from "@/hooks/useVisibleDataForAnalysisPage";
import { useSelectedMap } from "@/hooks/useSelectedMapName";
import { FarmData } from "@/interfaces/Farm";
import { layerResultText } from "@/utils/resultLabels";
import { getResultChipColor } from "@/utils/styling";
import { useLayerReading } from "@/hooks/useLayerRules";

interface SelectedPolygonsMapProps {
  farmsData: FarmData[];
  allPolygonsSelected: boolean;
  selectedPolygonIdAtMap: string | null;
  setSelectedPolygonIdAtMap: (id: string | null) => void;
}

export const SelectedPolygonsMap: React.FC<SelectedPolygonsMapProps> = ({
  farmsData,
  allPolygonsSelected,
  selectedPolygonIdAtMap,
  setSelectedPolygonIdAtMap,
}) => {
  const { territorialAnalysisResults } = useVisibleDataForAnalysisPage();
  const { t, i18n } = useTranslation();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { id: selectedMapId, alias: selectedMapAlias } = useSelectedMap();
  const { category, rule } = useLayerReading(selectedMapId);

  const selectedFarmData = useMemo(
    () => farmsData?.find((d) => d.id === selectedPolygonIdAtMap) || null,
    [farmsData, selectedPolygonIdAtMap]
  );

  const layerValue = useMemo<number | null>(
    () =>
      territorialAnalysisResults
        ?.find((d) => d.mapId === selectedMapId)
        ?.farmResults.find((d) => d.farmId === selectedPolygonIdAtMap)?.value ??
      null,
    [selectedMapId, selectedPolygonIdAtMap, territorialAnalysisResults]
  );

  const handlePolygonClick = useCallback(
    (id: string) => {
      setSelectedPolygonIdAtMap(id);
      setIsDetailsOpen(true);
    },
    [setSelectedPolygonIdAtMap]
  );

  const mapObjects = useMemo(
    () =>
      farmsData
        ?.filter((d) => allPolygonsSelected || selectedPolygonIdAtMap === d.id)
        .map((d) => {
          if (d.polygon.type === "polygon") {
            return {
              id: d.id,
              type: "polygon",
              parts: d.polygon.details?.parts ?? [],
              color: "yellow",
              fill: isDetailsOpen && selectedFarmData?.id === d.id,
              onClick: () => handlePolygonClick(d.id),
            } as PolygonObject;
          } else {
            return {
              id: d.id,
              type: "circle",
              center: d.polygon.details?.center ?? null,
              radius: d.polygon.details?.radius ?? 0,
              color: "yellow",
              fill: isDetailsOpen && selectedFarmData?.id === d.id,
              onClick: () => handlePolygonClick(d.id),
            } as CircleObject;
          }
        }),
    [
      farmsData,
      allPolygonsSelected,
      selectedPolygonIdAtMap,
      isDetailsOpen,
      selectedFarmData?.id,
      handlePolygonClick,
    ]
  );

  // Open details window when a polygon is selected at the map
  useEffect(() => {
    if (selectedPolygonIdAtMap === null) {
      setIsDetailsOpen(false);
    } else {
      setIsDetailsOpen(true);
    }
  }, [selectedPolygonIdAtMap]);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Map
        mapType="satellite"
        objects={mapObjects}
        autoZoom
        zoom={10}
        center={{ lat: -27.5, lng: -58.5 }}
        onMapClick={() => setIsDetailsOpen(false)}
      >
        <LayerTilesOverlay />
      </Map>
      <Slide direction="down" in={isDetailsOpen}>
        <Paper
          sx={{
            position: "absolute",
            top: 16,
            left: 16,
            padding: 2,
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Text variant="body1">{t("common:tableColumns:producer")}:</Text>
            <Text variant="body1" sx={{ marginLeft: 1, textAlign: "right" }}>
              {selectedFarmData?.producer}
            </Text>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Text variant="body1">{t("common:polygon")}:</Text>
            <Text variant="body1" sx={{ marginLeft: 1, textAlign: "right" }}>
              {selectedFarmData?.id}
            </Text>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Text variant="body1">{t("common:surface")}:</Text>
            <Text variant="body1" sx={{ marginLeft: 1, textAlign: "right" }}>
              {formatArea(selectedFarmData?.polygon.area, i18n.language)}
            </Text>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Text variant="body1">{t("common:tableColumns:cropType")}:</Text>
            <Text variant="body1" sx={{ marginLeft: 1, textAlign: "right" }}>
              {selectedFarmData?.cropType}
            </Text>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Text variant="body1">
              {t("territorialAnalysis:results.layerResult")} (
              {selectedMapAlias}):
            </Text>
            <Text
              variant="body1"
              bold
              boldWeight={700}
              sx={{
                marginLeft: 1,
                textAlign: "right",
                color: getResultChipColor(
                  layerValue,
                  rule
                ),
              }}
            >
              {layerResultText(layerValue, category, t, i18n.language)}
            </Text>
          </Box>
        </Paper>
      </Slide>
    </Box>
  );
};
