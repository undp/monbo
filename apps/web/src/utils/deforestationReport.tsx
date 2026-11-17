import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
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
} from "./deforestationReport/sections";
import { categoryOf, groupLayersByCategory } from "./layerCategories";
import { styles } from "./deforestationReport/styles";
import { assetUrl } from "./deforestationReport/assets";

export interface DeforestationReportImage {
  mapId: number;
  farmId: string;
  url: string | null;
}

// react-pdf's own hyphenation uses English rules and splits Spanish words
// ("iden-tifica", "prote-gida"), so words stay whole. Only a word longer than any
// Spanish or English one (a URL in the references, an id) is split, after its URL
// separators and in parts that fit a table cell: whole, it would run past the page
// and be cut off in print. react-pdf prints a "-" where it breaks one (the link keeps
// the exact URL), so it never breaks right after a "-" or "_": that would read "--".
const LONGEST_WHOLE_WORD = 30;
const LONGEST_PART = 24;
const PARTS = new RegExp(`.{1,${LONGEST_PART}}`, "g");

/** A word's break points for the report (see above): `[word]` keeps it whole. */
export const reportWordParts = (word: string): string[] => {
  if (word.length <= LONGEST_WHOLE_WORD) return [word];
  // Pieces that end after a separator, none longer than LONGEST_PART
  const pieces = (word.match(/[^/?#&;=.]*[/?#&;=.]?/g) ?? [])
    .filter(Boolean)
    .flatMap((token) => token.match(PARTS) ?? []);
  const parts: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + piece.length > LONGEST_PART) {
      parts.push(current);
      current = "";
    }
    current += piece;
  }
  if (current) parts.push(current);
  return parts;
};

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
  results: DeforestationAnalysisMapResults[],
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
      category: categoryOf(map, categories),
      results: layerResults,
    };
  });
  return groupLayersByCategory(layers, categories);
};

export const DeforestationReportDocument = ({
  farmsData,
  deforestationAnalysisResults,
  mapsData,
  categories,
  images,
  satelliteBackground,
  t,
  language,
  onRender,
  showLinks = true,
}: {
  farmsData: FarmData[];
  deforestationAnalysisResults: DeforestationAnalysisMapResults[];
  mapsData: MapData[];
  /** The country's categories (GET /categories): each layer's rule and texts. */
  categories: LayerCategory[];
  images: DeforestationReportImage[];
  /** Whether the map images have the satellite background (its caption). */
  satelliteBackground: boolean;
  t: TFunction;
  language?: string;
  onRender?: () => void;
  showLinks?: boolean;
}) => {
  const groups = reportLayerGroups(
    deforestationAnalysisResults,
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
