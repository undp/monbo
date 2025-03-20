import { useCallback, useContext } from "react";
import { saveAs } from "file-saver";
import { generateExcel, SheetData } from "@/utils/excel";
import { SnackbarContext } from "@/context/SnackbarContext";
import { useTranslation } from "react-i18next";

export const useExcelDownload = () => {
  const { openSnackbar } = useContext(SnackbarContext);
  const { t } = useTranslation(["common"]);

  return useCallback(
    async (data: Record<string, SheetData>, filename: string) => {
      try {
        const file = generateExcel(data);
        saveAs(file, filename);
      } catch (error) {
        console.error("Error generating Excel:", error);
        openSnackbar({
          message: t("common:snackbarAlerts:errorGeneratingExcelFile"),
          type: "error",
        });
      }
    },
    [openSnackbar, t]
  );
};
