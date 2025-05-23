import { DataContext } from "@/context/DataContext";
import { useContext, useEffect, useMemo, useState } from "react";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import {
  DeforestationReportDocument,
  DeforestationReportImage,
} from "@/utils/deforestationReport";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import { fetchDeforestationImages } from "@/utils/deforestationImages";

export const useDeforestationCompleteReportDocument = () => {
  const { t } = useTranslation();
  const params = useParams();
  const locale = params.locale as string;
  const { deforestationAnalysisResults } = useVisibleDataForDeforestationPage();
  const {
    reportGenerationParams: {
      selectedMaps: selectedMapsForReport,
      selectedFarms: selectedFarmsForReport,
    },
  } = useContext(DataContext);

  const [images, setImages] = useState<DeforestationReportImage[]>([]);
  const [areImagesLoading, setAreImagesLoading] = useState(false);
  const [isDocumentRendering, setIsDocumentRendering] = useState(false);

  const filteredDeforestationAnalysisResults = useMemo(() => {
    return deforestationAnalysisResults?.filter((m) =>
      selectedMapsForReport.some((map) => map.id === m.mapId)
    );
  }, [deforestationAnalysisResults, selectedMapsForReport]);

  useEffect(() => {
    if (
      !selectedFarmsForReport.length ||
      !selectedMapsForReport.length ||
      !filteredDeforestationAnalysisResults.length
    )
      return;

    // TODO: improve the performance of fetching the images
    const fetchImages = async () => {
      setAreImagesLoading(true);

      const results = await fetchDeforestationImages(
        selectedMapsForReport,
        selectedFarmsForReport,
        filteredDeforestationAnalysisResults
      );

      setImages(results);
      setAreImagesLoading(false);
    };

    fetchImages();
  }, [
    selectedFarmsForReport,
    selectedMapsForReport,
    filteredDeforestationAnalysisResults,
  ]);

  const document = useMemo(() => {
    if (
      !selectedFarmsForReport.length ||
      !selectedMapsForReport.length ||
      !filteredDeforestationAnalysisResults.length ||
      !images.length
    )
      return null;
    setIsDocumentRendering(true);
    return (
      <DeforestationReportDocument
        farmsData={selectedFarmsForReport}
        deforestationAnalysisResults={filteredDeforestationAnalysisResults}
        mapsData={selectedMapsForReport}
        images={images}
        t={t}
        language={locale}
        onRender={() => {
          setIsDocumentRendering(false);
        }}
        showLinks={false}
      />
    );
  }, [
    selectedFarmsForReport,
    selectedMapsForReport,
    filteredDeforestationAnalysisResults,
    images,
    t,
    locale,
  ]);

  return { document, isLoading: areImagesLoading || isDocumentRendering };
};
