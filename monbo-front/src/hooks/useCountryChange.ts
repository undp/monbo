import { useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { DataContext } from "@/context/DataContext";

interface CountryChangeOptions {
  // Where to go once the country is set (the landing page goes to /home).
  navigateTo?: string;
}

/**
 * The one way to change the analysis country. Before a deforestation analysis the
 * change applies at once: farms and validation results stay, chosen layers are
 * cleared. After an analysis it waits for the user to confirm a restart
 * (`pendingCountry`), which drops every loaded result and goes to /home.
 */
export function useCountryChange() {
  const {
    selectedCountry,
    setSelectedCountry,
    deforestationAnalysisResults,
    resetAnalysis,
    setDeforestationAnalysisParams,
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
      setSelectedCountry(code);
      setDeforestationAnalysisParams((prev) => ({ ...prev, selectedMaps: [] }));
      setReportGenerationParams((prev) => ({ ...prev, selectedMaps: [] }));
      if (navigateTo) router.push(navigateTo);
    },
    [
      selectedCountry,
      deforestationAnalysisResults,
      setSelectedCountry,
      setDeforestationAnalysisParams,
      setReportGenerationParams,
      router,
    ]
  );

  const confirmRestart = useCallback(() => {
    if (!pendingCountry) return;
    resetAnalysis();
    setSelectedCountry(pendingCountry);
    setPendingCountry(null);
    router.push("/home");
  }, [pendingCountry, resetAnalysis, setSelectedCountry, router]);

  const cancelRestart = useCallback(() => setPendingCountry(null), []);

  return { requestCountryChange, pendingCountry, confirmRestart, cancelRestart };
}
