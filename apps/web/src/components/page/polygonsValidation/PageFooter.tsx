"use client";

import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { DataContext } from "@/context/DataContext";
import { getCountryName } from "@/utils/countries";
import { localizedPath } from "@/utils/languageChange";
import { NextStageCard } from "@/components/page/flow/NextStageCard";

/**
 * Closes stage 1: the card to the territorial analysis. Its page asks for the
 * polygon subset and the layers, and starts nothing until "Analizar".
 */
export const PageFooter: React.FC = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { selectedCountry } = useContext(DataContext);
  const country = selectedCountry
    ? (getCountryName(selectedCountry, i18n.language === "en" ? "en" : "es") ??
      selectedCountry)
    : "";

  return (
    <NextStageCard
      stage={2}
      title={t("flow:nextStage.analysis.title")}
      description={t("flow:nextStage.analysis.description", { country })}
      onContinue={() =>
        router.push(
          localizedPath("/deforestation-analysis/upload-data", i18n.language)
        )
      }
    />
  );
};
