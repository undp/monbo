"use client";

import { useTranslation } from "react-i18next";
import { useFlowStages } from "@/hooks/useFlowStages";
import { PageEyebrow } from "./PageEyebrow";

/** "Stage N of 3", above a stage page's title. */
export const StageEyebrow: React.FC = () => {
  const { t } = useTranslation();
  const { current } = useFlowStages();
  if (!current) return null;

  return <PageEyebrow>{t("flow:stageOf", { stage: current })}</PageEyebrow>;
};
