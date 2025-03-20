"use client";

import { ModuleCard } from "@/components/page/home/ModuleCard";
import { ActionModal } from "@/components/reusable/Modals/ActionModal";
import { DataContext } from "@/context/DataContext";
import { useModuleRouter } from "@/hooks/useModuleRouter";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useState } from "react";
import { useTranslation } from "react-i18next";

export const DeforestationModuleCard: React.FC = () => {
  const router = useRouter();
  const {
    farmsData,
    polygonsValidationResults,
    deforestationAnalysisResults,
    setFarmsData,
    setDeforestationAnalysisResults,
    setPolygonsValidationResults,
  } = useContext(DataContext);
  const [newDataModalIsOpen, setNewDataModalIsOpen] = useState(false);
  const goToModule = useModuleRouter("/deforestation-analysis");
  const { t } = useTranslation();

  const handleClick = useCallback(() => {
    if (farmsData) {
      setNewDataModalIsOpen(true);
    } else {
      goToModule();
    }
  }, [farmsData, goToModule]);

  return (
    <>
      <ModuleCard
        step={2}
        textNamespace="home:deforestation"
        color="#4364C2"
        imgSrc="/images/Step2Img.svg"
        onPress={handleClick}
      />
      <ActionModal
        maxWidth="md"
        isOpen={newDataModalIsOpen}
        title={t("home:sameDataModal:deforestationAnalysis:title")}
        description={t("home:sameDataModal:deforestationAnalysis:description")}
        handleClose={() => setNewDataModalIsOpen(false)}
        actions={[
          {
            title: t("home:sameDataModal:uploadNewData"),
            handler: () => {
              setFarmsData(null);
              setPolygonsValidationResults(null);
              setDeforestationAnalysisResults(null);
              router.push("/deforestation-analysis/upload-data");
            },
            variant: "outlined",
          },
          {
            title: t("home:sameDataModal:sameData"),
            handler: goToModule,
            variant: "contained",
            disabled:
              !!polygonsValidationResults && !deforestationAnalysisResults,
          },
        ]}
      />
    </>
  );
};
