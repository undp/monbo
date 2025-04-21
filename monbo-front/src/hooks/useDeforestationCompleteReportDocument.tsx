import { DataContext } from "@/context/DataContext";
import { useContext, useEffect, useMemo, useState } from "react";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import {
  DeforestationReportDocument,
  DeforestationReportImage,
} from "@/utils/deforestationReport";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import { generatePolygonDeforestationImage } from "@/api/deforestationAnalysis";
import { generateGeoJsonFeature } from "@/utils/geojson";
import { flatten } from "lodash";

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
      const results = await Promise.all(
        flatten(
          selectedMapsForReport.map(({ id: mapId }) =>
            selectedFarmsForReport.map(async (farm) => {
              const hasResults = !!filteredDeforestationAnalysisResults
                .find((m) => m.mapId === mapId)
                ?.farmResults.some(
                  ({ farmId, value }) => farmId === farm.id && value !== null
                );
              if (!hasResults)
                return {
                  mapId,
                  farmId: farm.id,
                  url: null,
                };

              const blob = await generatePolygonDeforestationImage(
                mapId,
                generateGeoJsonFeature(farm)
              );
              return {
                mapId,
                farmId: farm.id,
                url: URL.createObjectURL(blob),
              };
            })
          )
        )
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
