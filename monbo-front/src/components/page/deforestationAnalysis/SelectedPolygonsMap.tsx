"use client";

import { CircleObject, Map, PolygonObject } from "@/components/reusable/Map";
import { Box, Paper, Slide } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Text } from "@/components/reusable/Text";
import { parsePolygonArea } from "@/utils/polygons";
import { formatDeforestationPercentage } from "@/utils/numbers";
import { useTranslation } from "react-i18next";
import { DeforestationMapOverlay } from "./DeforestationMapOverlay";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { useSelectedMap } from "@/hooks/useSelectedMapName";
import { FarmData } from "@/interfaces/Farm";
import { isDeforestationAboveThreshold } from "@/utils/deforestation";

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
  const { deforestationAnalysisResults } = useVisibleDataForDeforestationPage();
  const { t, i18n } = useTranslation();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { id: selectedMapId, alias: selectedMapAlias } = useSelectedMap();

  const selectedFarmData = useMemo(
    () => farmsData?.find((d) => d.id === selectedPolygonIdAtMap) || null,
    [farmsData, selectedPolygonIdAtMap]
  );

  const deforestationLevel = useMemo(
    () =>
      deforestationAnalysisResults
        ?.find((d) => d.mapId === selectedMapId)
        ?.farmResults.find((d) => d.farmId === selectedPolygonIdAtMap)?.value,
    [selectedMapId, selectedPolygonIdAtMap, deforestationAnalysisResults]
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
              path: d.polygon.details?.path ?? [],
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
        <DeforestationMapOverlay />
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
              {parsePolygonArea(
                selectedFarmData?.polygon.area || 0,
                i18n.language
              )}
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
              {t("deforestationAnalysis:deforestationLevel")} (
              {selectedMapAlias}):
            </Text>
            <Text
              variant="body1"
              bold
              boldWeight={700}
              sx={{
                marginLeft: 1,
                textAlign: "right",
                textTransform: "uppercase",
                color:
                  deforestationLevel !== undefined &&
                  deforestationLevel !== null
                    ? deforestationLevel > 0
                      ? "#D32F2F"
                      : "#2E7D32"
                    : undefined,
              }}
            >
              {deforestationLevel !== undefined && deforestationLevel !== null
                ? isDeforestationAboveThreshold(deforestationLevel)
                  ? `${formatDeforestationPercentage(
                      deforestationLevel,
                      i18n.language
                    )} Def.`
                  : t("deforestationAnalysis:deforestationFreeShortText")
                : t("common:na")}
            </Text>
          </Box>
        </Paper>
      </Slide>
    </Box>
  );
};
