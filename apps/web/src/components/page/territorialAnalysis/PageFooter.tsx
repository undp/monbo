"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { NextStageCard } from "@/components/page/flow/NextStageCard";
import { MapSelectionModal } from "./MapSelectionModal";

/** Closes stage 2: the card to the report, through the report layer modal. */
export function PageFooter() {
  const { t } = useTranslation();
  const router = useRouter();

  const [isMapSelectionModalOpen, setIsMapSelectionModalOpen] = useState(false);

  const handleContinue = useCallback(() => {
    router.push("/report-generation");
  }, [router]);

  return (
    <>
      <NextStageCard
        stage={3}
        title={t("flow:nextStage.report.title")}
        description={t("flow:nextStage.report.description")}
        onContinue={() => setIsMapSelectionModalOpen(true)}
      />
      <MapSelectionModal
        isOpen={isMapSelectionModalOpen}
        handleClose={() => setIsMapSelectionModalOpen(false)}
        handleContinue={handleContinue}
      />
    </>
  );
}
