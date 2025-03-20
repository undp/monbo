import { useCallback, useContext } from "react";
import { saveAs } from "file-saver";
import { SnackbarContext } from "@/context/SnackbarContext";
import { useTranslation } from "react-i18next";

interface GeoJsonFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: "Point" | "Polygon";
    coordinates: number[] | number[][][] | number[][];
  };
}

export interface GeoJsonData {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export const useGeoJsonDownload = () => {
  const { openSnackbar } = useContext(SnackbarContext);
  const { t } = useTranslation(["common"]);

  return useCallback(
    async (data: GeoJsonData, filename: string) => {
      try {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/geo+json",
        });
        saveAs(blob, filename);
      } catch (error) {
        console.error("Error generating GeoJSON:", error);
        openSnackbar({
          message: t("common:snackbarAlerts:errorGeneratingGeoJsonFile"),
          type: "error",
        });
      }
    },
    [openSnackbar, t]
  );
};
