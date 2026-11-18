import { useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { useModuleRouter } from "./useModuleRouter";

export type EntryStage = 1 | 2;

const STAGES = {
  1: {
    path: "/polygons-validation",
    title: "home:sameDataModal:polygonValidation:title",
    description: "home:sameDataModal:polygonValidation:description",
  },
  2: {
    path: "/deforestation-analysis",
    title: "home:sameDataModal:deforestationAnalysis:title",
    description: "home:sameDataModal:deforestationAnalysis:description",
  },
} as const;

/**
 * Opening stage 1 or 2 from the start page. Without farms it goes to the stage's
 * upload page. With farms loaded it first asks, through `modal` (props for
 * ActionModal), whether to continue with the same data or upload new data.
 */
export function useStageEntry(stage: EntryStage) {
  const { path, title, description } = STAGES[stage];
  const {
    farmsData,
    polygonsValidationResults,
    deforestationAnalysisResults,
    resetAnalysis,
  } = useContext(DataContext);
  const router = useRouter();
  const { t } = useTranslation();
  const goToStage = useModuleRouter(path);
  const [isOpen, setIsOpen] = useState(false);

  const enter = useCallback(() => {
    if (farmsData) setIsOpen(true);
    else goToStage();
  }, [farmsData, goToStage]);

  // The same data can't continue into a stage whose results it lacks while the
  // other stage has them (e.g. analysed directly, without a validation).
  const sameDataDisabled =
    stage === 1
      ? !polygonsValidationResults && !!deforestationAnalysisResults
      : !!polygonsValidationResults && !deforestationAnalysisResults;

  const modal = {
    maxWidth: "md" as const,
    isOpen,
    title: t(title),
    description: t(description),
    handleClose: () => setIsOpen(false),
    actions: [
      {
        title: t("home:sameDataModal:uploadNewData"),
        handler: () => {
          resetAnalysis();
          router.push(`${path}/upload-data`);
        },
        variant: "outlined" as const,
      },
      {
        title: t("home:sameDataModal:sameData"),
        handler: goToStage,
        variant: "contained" as const,
        disabled: sameDataDisabled,
      },
    ],
  };

  return { enter, modal };
}
