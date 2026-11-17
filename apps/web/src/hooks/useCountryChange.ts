import { useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { DataContext } from "@/context/DataContext";

interface CountryChangeOptions {
  // Where to go once the country is set.
  navigateTo?: string;
}

/**
 * The one way to change the analysis country. Before a deforestation analysis the
 * change applies at once: farms and validation results stay, chosen layers are
 * cleared. After an analysis it waits for the user to confirm a restart
 * (`pendingCountry`), which drops every loaded result and goes to the start page.
 */
export function useCountryChange() {
  const {
    selectedCountry,
    setSelectedCountry,
    deforestationAnalysisResults,
    resetAnalysis,
    setFarmsData,
    setDeforestationAnalysisParams,
    setAnalysisDraft,
    setReportGenerationParams,
  } = useContext(DataContext);
  const router = useRouter();
  const [pendingCountry, setPendingCountry] = useState<string | null>(null);

  const requestCountryChange = useCallback(
    (code: string, { navigateTo }: CountryChangeOptions = {}) => {
      if (code === selectedCountry) {
        if (navigateTo) router.push(navigateTo);
        return;
      }
      if (deforestationAnalysisResults) {
        setPendingCountry(code);
        return;
      }
      setDeforestationAnalysisParams((prev) => ({ ...prev, selectedMaps: [] }));
      // Another country's layers: the next analysis starts from none.
      setAnalysisDraft(null);
      setFarmsData(
        (prev) => prev?.map((farm) => ({ ...farm, country: code })) ?? null
      );
      setReportGenerationParams((prev) => ({
        ...prev,
        selectedMaps: [],
        selectedFarms: prev.selectedFarms.map((farm) => ({
          ...farm,
          country: code,
        })),
      }));
      setSelectedCountry(code);
      if (navigateTo) router.push(navigateTo);
    },
    [
      selectedCountry,
      deforestationAnalysisResults,
      setFarmsData,
      setSelectedCountry,
      setDeforestationAnalysisParams,
      setAnalysisDraft,
      setReportGenerationParams,
      router,
    ]
  );

  const confirmRestart = useCallback(() => {
    if (!pendingCountry) return;
    resetAnalysis();
    setSelectedCountry(pendingCountry);
    setPendingCountry(null);
    router.push("/");
  }, [pendingCountry, resetAnalysis, setSelectedCountry, router]);

  const cancelRestart = useCallback(() => setPendingCountry(null), []);

  return { requestCountryChange, pendingCountry, confirmRestart, cancelRestart };
}
