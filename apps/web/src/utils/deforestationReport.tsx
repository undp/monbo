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
import { assetUrl } from "./deforestationReport/assets";

export interface DeforestationReportImage {
  mapId: number;
  farmId: string;
  url: string | null;
}

// Served by the web itself (public/fonts/roboto, OFL): the weights the report uses.
let fontsRegistered = false;
export const registerReportFonts = () => {
  if (fontsRegistered) return;
  fontsRegistered = true;
  Font.register({
    family: "Roboto",
    fonts: [
      { src: assetUrl("/fonts/roboto/Roboto-Regular.ttf"), fontWeight: 400 },
      { src: assetUrl("/fonts/roboto/Roboto-Medium.ttf"), fontWeight: 500 },
      { src: assetUrl("/fonts/roboto/Roboto-Bold.ttf"), fontWeight: 700 },
    ],
  });
};

// Create Document Component
export const DeforestationReportDocument = ({
  farmsData,
  deforestationAnalysisResults,
  mapsData,
  images,
  t,
  language,
  onRender,
  showLinks = true,
}: {
  farmsData: FarmData[];
  deforestationAnalysisResults: DeforestationAnalysisMapResults[];
  mapsData: MapData[];
  images: DeforestationReportImage[];
  t: TFunction;
  language?: string;
  onRender?: () => void;
  showLinks?: boolean;
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

            if (farmMapResult.value === null) return null;

            const map = mapsData.find((m) => m.id === mapResults.mapId);
            if (!map)
              throw new Error(`Map data not found for map ${mapResults.mapId}`);

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
                showLinks={showLinks}
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
        t={t}
        showLinks={showLinks}
      />
    </Document>
  );
};
