import { useCallback, useContext } from "react";
import { DataContext } from "@/context/DataContext";
import { ReportContext } from "@/context/ReportContext";
import { sendUsageEvent } from "@/api/usageEvents";

export type MissingChoice = "noFarms" | "noLayers";

/**
 * Asking for the report's preview, from any of its buttons: what the choice lacks
 * for one (no polygon, no layer), and the request itself, which is recorded as a
 * `report_requested` usage event.
 */
export const useReportPreviewRequest = () => {
  const {
    reportGenerationParams: { selectedFarms, selectedMaps },
    selectedCountry,
  } = useContext(DataContext);
  const { requestPreview } = useContext(ReportContext);

  const missing: MissingChoice | null = !selectedFarms.length
    ? "noFarms"
    : !selectedMaps.length
      ? "noLayers"
      : null;

  const request = useCallback(() => {
    if (missing) return;
    sendUsageEvent(
      { type: "report_requested", outcome: "ok", farms: selectedFarms.length },
      selectedCountry
    );
    requestPreview();
  }, [missing, selectedFarms.length, selectedCountry, requestPreview]);

  return { missing, request };
};
