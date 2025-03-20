"use client";

import { ModuleCard } from "@/components/page/home/ModuleCard";
import { useModuleRouter } from "@/hooks/useModuleRouter";
import { ActionModal } from "@/components/reusable/Modals/ActionModal";
import { useCallback, useContext, useState } from "react";
import { DataContext } from "@/context/DataContext";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

export const PolygonValidationModuleCard: React.FC = () => {
  const router = useRouter();
  const {
    farmsData,
    polygonsValidationResults,
    deforestationAnalysisResults,
    setFarmsData,
    setPolygonsValidationResults,
    setDeforestationAnalysisResults,
  } = useContext(DataContext);
  const [newDataModalIsOpen, setNewDataModalIsOpen] = useState(false);
  const goToModule = useModuleRouter("/polygons-validation");
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
        step={1}
        textNamespace="home:validation"
        color="#EC7431"
        imgSrc="/images/Step1Img.svg"
        onPress={handleClick}
      />
      <ActionModal
        maxWidth="md"
        isOpen={newDataModalIsOpen}
        title={t("home:sameDataModal:polygonValidation:title")}
        description={t("home:sameDataModal:polygonValidation:description")}
        handleClose={() => setNewDataModalIsOpen(false)}
        actions={[
          {
            title: t("home:sameDataModal:uploadNewData"),
            handler: () => {
              setFarmsData(null);
              setPolygonsValidationResults(null);
              setDeforestationAnalysisResults(null);
              router.push("/polygons-validation/upload-data");
            },
            variant: "outlined",
          },
          {
            title: t("home:sameDataModal:sameData"),
            handler: goToModule,
            variant: "contained",
            disabled:
              !polygonsValidationResults && !!deforestationAnalysisResults,
          },
        ]}
      />
    </>
  );
};
