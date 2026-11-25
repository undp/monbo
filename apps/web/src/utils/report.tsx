import {
  LayerAnalysisMapResults,
  MapData,
} from "@/interfaces/LayerAnalysis";
import { FarmData } from "@/interfaces/Farm";
import { Font, Document } from "@react-pdf/renderer";
import { TFunction } from "i18next";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import {
  CoverPage,
  FarmSheetPage,
  LayerScopePages,
  MapPage,
  MethodologyPage,
  type ReportLayer,
} from "./report/sections";
import { groupLayersByCategory, layerCategory } from "./layerResults";
import { styles } from "./report/styles";
import { assetUrl } from "./report/assets";
import { reportWordParts } from "./report/wordBreaks";

export interface ReportImage {
  mapId: number;
  farmId: string;
  url: string | null;
}

// Served by the web itself (public/fonts/roboto, Apache 2.0): every weight and style
// the report uses. The layers' considerations are markdown, and their _italic_ and
// **_bold italic_** need the italic faces: a missing face fails the whole render.
let fontsRegistered = false;
export const registerReportFonts = () => {
  if (fontsRegistered) return;
  fontsRegistered = true;
  Font.registerHyphenationCallback(reportWordParts);
  Font.register({
    family: "Roboto",
    fonts: [
      { src: assetUrl("/fonts/roboto/Roboto-Regular.ttf"), fontWeight: 400 },
      { src: assetUrl("/fonts/roboto/Roboto-Medium.ttf"), fontWeight: 500 },
      { src: assetUrl("/fonts/roboto/Roboto-Bold.ttf"), fontWeight: 700 },
      {
        src: assetUrl("/fonts/roboto/Roboto-Italic.ttf"),
        fontWeight: 400,
        fontStyle: "italic",
      },
      {
        src: assetUrl("/fonts/roboto/Roboto-BoldItalic.ttf"),
        fontWeight: 700,
        fontStyle: "italic",
      },
    ],
  });
};

/**
 * The report's layers, grouped by category: one per layer with results, with its
 * metadata from `mapsData` and its category from `categories` (null when unknown).
 */
export const reportLayerGroups = (
  results: LayerAnalysisMapResults[],
  mapsData: MapData[],
  categories: LayerCategory[]
) => {
  const layers: ReportLayer[] = results.map((layerResults) => {
    const map = mapsData.find((m) => m.id === layerResults.mapId);
    if (!map)
      throw new Error(`Map data not found for map ${layerResults.mapId}`);
    return {
      id: map.id,
      categoryId: map.categoryId,
      map,
      category: layerCategory(map, categories),
      results: layerResults,
    };
  });
  return groupLayersByCategory(layers, categories);
};

export const ReportDocument = ({
  farmsData,
  territorialAnalysisResults,
  mapsData,
  categories,
  images,
  satelliteBackground,
  t,
  language = "es",
  onRender,
  showLinks = true,
}: {
  farmsData: FarmData[];
  territorialAnalysisResults: LayerAnalysisMapResults[];
  mapsData: MapData[];
  /** The country's categories (GET /categories): each layer's rule and texts. */
  categories: LayerCategory[];
  images: ReportImage[];
  /** Whether the map images have the satellite background (its caption). */
  satelliteBackground: boolean;
  t: TFunction;
  language?: string;
  onRender?: () => void;
  showLinks?: boolean;
}) => {
  const groups = reportLayerGroups(
    territorialAnalysisResults,
    mapsData,
    categories
  );
  const layers = groups.flatMap((group) => group.layers);

  return (
    <Document style={styles.document} onRender={onRender}>
      <CoverPage farmsData={farmsData} groups={groups} t={t} language={language} />

      {/* Each farm: its sheet (every layer, "No data" included), then a map page
          per layer with a result. A farm is never left out. */}
      {farmsData.flatMap((farm, farmIndex) => [
        <FarmSheetPage
          key={`${farm.id}-sheet`}
          farm={farm}
          groups={groups}
          categories={categories}
          t={t}
          language={language}
          showLinks={showLinks}
          anchor={farmIndex === 0}
        />,
        ...layers
          .filter(
            ({ results }) =>
              results.farmResults.find(({ farmId }) => farmId === farm.id)
                ?.value != null
          )
          .map((layer) => (
            <MapPage
              key={`${farm.id}-${layer.map.id}`}
              farm={farm}
              layer={layer}
              t={t}
              language={language}
              imageBlobUrl={
                images.find(
                  (i) => i.mapId === layer.map.id && i.farmId === farm.id
                )?.url ?? null
              }
              satelliteBackground={satelliteBackground}
            />
          )),
      ])}

      <MethodologyPage groups={groups} t={t} language={language} />

      <LayerScopePages
        groups={groups}
        t={t}
        language={language}
        showLinks={showLinks}
      />
    </Document>
  );
};
