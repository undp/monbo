"use client";

import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { NextStageCard } from "@/components/page/flow/NextStageCard";
import { localizedPath } from "@/utils/languageChange";

/** Closes stage 2: the card to the report page, where its choices are made. */
export function PageFooter() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  return (
    <NextStageCard
      stage={3}
      title={t("flow:nextStage.report.title")}
      description={t("flow:nextStage.report.description")}
      onContinue={() =>
        router.push(localizedPath("/report-generation", i18n.language))
      }
    />
  );
}
