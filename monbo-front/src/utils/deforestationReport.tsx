import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import { FarmData } from "@/interfaces/Farm";
import { Font, Document } from "@react-pdf/renderer";
import { TFunction } from "i18next";
import {
  CoverPage,
  DeforestationExplanationPage,
  FarmMapPage,
  MapDescriptionPage,
} from "./deforestationReport/sections";
import { flatten } from "lodash";
import { styles } from "./deforestationReport/styles";

export interface DeforestationReportImage {
  mapId: number;
  farmId: string;
  url: string | null;
}

// Register Roboto font
Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/roboto/v30/KFOjCnqEu92Fr1Mu51TjASc6CsQ.ttf",
      fontWeight: 300, // Light ✅
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf",
      fontWeight: 400, // Regular ✅
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9fBBc9.ttf",
      fontWeight: 500, // Medium ✅
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc9.ttf",
      fontWeight: 700, // Bold (Roboto has no 600 weight) ✅
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu7GxK.ttf",
      fontWeight: 900, // Black (Optional, if you need heavier text) ✅
    },
  ],
});

// Create Document Component
export const DeforestationReportDocument = ({
  farmsData,
  deforestationAnalysisResults,
  mapsData,
  images,
  t,
  language,
  onRender,
}: {
  farmsData: FarmData[];
  deforestationAnalysisResults: DeforestationAnalysisMapResults[];
  mapsData: MapData[];
  images: DeforestationReportImage[];
  t: TFunction;
  language?: string;
  onRender?: () => void;
}) => {
  return (
    <Document style={styles.document} onRender={onRender}>
      {/* COVER PAGE */}
      <CoverPage farmsData={farmsData} t={t} language={language} />

      {/* FARM-MAP PAGES */}
      {flatten(
        farmsData.map((farm) =>
          deforestationAnalysisResults.map((mapResults) => {
            const farmMapResult = mapResults.farmResults.find(
              (r) => r.farmId === farm.id
            );
            if (!farmMapResult)
              throw new Error(
                `Map results not found for farm ${farm.id} and map ${mapResults.mapId}`
              );

            const map = mapsData.find((m) => m.id === mapResults.mapId);
            if (!map)
              throw new Error(`Map data not found for map ${mapResults.mapId}`);

            farm.documents.forEach((document) => {
              document.name = null as unknown as string;
            });

            const imageBlobUrl =
              images.find(
                (i) => i.mapId === mapResults.mapId && i.farmId === farm.id
              )?.url ?? null;

            return (
              <FarmMapPage
                key={`${farm.id}-${mapResults.mapId}`}
                farm={farm}
                map={map}
                result={farmMapResult}
                t={t}
                language={language}
                imageBlobUrl={imageBlobUrl}
              />
            );
          })
        )
      ).filter(Boolean)}

      {/* EXPLANATION OF THE DEFORESTATION CALCULATION */}
      <DeforestationExplanationPage t={t} />

      {/* EXPLANATION OF THE MAPS USED FOR THE DEFORESTATION ANALYSIS */}
      <MapDescriptionPage
        deforestationAnalysisResults={deforestationAnalysisResults}
        mapsData={mapsData}
      />
    </Document>
  );
};
