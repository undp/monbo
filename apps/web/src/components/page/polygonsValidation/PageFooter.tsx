"use client";

import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { getCountryName } from "@/utils/countries";
import { NextStageCard } from "@/components/page/flow/NextStageCard";
import { DeforestationModal } from "./DeforestationModal";

/** Closes stage 1: the card to the territorial analysis, through its modal. */
export const PageFooter: React.FC = () => {
  const [isDeforestationModalOpen, setIsDeforestationModalOpen] =
    useState(false);
  const { t, i18n } = useTranslation();
  const { selectedCountry } = useContext(DataContext);
  const country = selectedCountry
    ? (getCountryName(selectedCountry, i18n.language === "en" ? "en" : "es") ??
      selectedCountry)
    : "";

  return (
    <>
      <NextStageCard
        stage={2}
        title={t("flow:nextStage.analysis.title")}
        description={t("flow:nextStage.analysis.description", { country })}
        onContinue={() => setIsDeforestationModalOpen(true)}
      />
      <DeforestationModal
        isOpen={isDeforestationModalOpen}
        handleClose={() => setIsDeforestationModalOpen(false)}
      />
    </>
  );
};
