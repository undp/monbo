import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import { FarmData } from "@/interfaces/Farm";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import {
  Page,
  Text,
  View,
  Link,
  Image as ImagePDF,
  Styles,
} from "@react-pdf/renderer";
import { resultClassBackgroundColor, resultClassColor } from "../styling";
import { map as pluck } from "lodash";
import { TFunction } from "i18next";
import { generateGeoJsonFarmsDataWithDeforestationAnalysis } from "../geojson";
import { parseAreaToHectares } from "../polygons";
import { longFormatDateByLanguage, shortFormatDateByLanguage } from "../dates";
import { formatThreshold } from "../numbers";
import {
  categoryClass,
  layerResult,
  localizedText,
  type CategoryGroup,
  type LayerResult,
} from "../layerCategories";
import type { ResultClass } from "../layerResults";
import { layerLabel } from "../layerLabel";
import { styles } from "./styles";
import { assetUrl } from "./assets";
import { Considerations } from "./considerations";
import { getCommaSeparatedUniqueTexts } from "@/utils/strings";
import { DOWNLOAD_GEOJSON_URL } from "@/config/env";

// The report's pages. The cover shows no result (D8 of undp/monbo#116). Each farm
// has a sheet with every selected layer's result, grouped by category, and a map
// page per layer with a result. Methodology and each layer's scope come last.

/** Targets of the cover's index (react-pdf internal links: `#<id>`). */
export const REPORT_ANCHORS = {
  farmSheets: "farm-sheets",
  methodology: "methodology",
  scope: "scope",
} as const;

/** A layer of the report, its category (null when unknown) and the farms' values. */
export interface ReportLayer {
  /** The layer's id and category id, as in `map` (to group it by category). */
  id: number;
  categoryId: string;
  map: MapData;
  category: LayerCategory | null;
  results: DeforestationAnalysisMapResults;
}

/** The value of `farm` for `layer`: undefined when the analysis has none. */
const valueOf = (layer: ReportLayer, farm: FarmData) =>
  layer.results.farmResults.find(({ farmId }) => farmId === farm.id)?.value;

const categoryName = (
  category: LayerCategory | null,
  t: TFunction,
  language?: string
) =>
  category
    ? localizedText(category.name, language)
    : t("common:layerResults:noCategory");

/** Grey for a layer without a known category. */
const categoryColor = (category: LayerCategory | null) =>
  category?.color ?? resultClassColor("unknown");

/** Baseline–comparison year, or the content date for a non-temporal layer. */
const layerPeriod = (map: MapData, t: TFunction) =>
  map.baseline !== null && map.comparedAgainst !== null
    ? `${map.baseline}–${map.comparedAgainst}`
    : map.contentDate ?? t("common:na");

const Footer = ({ t, numbered = true }: { t: TFunction; numbered?: boolean }) => (
  <View style={styles.footer} fixed>
    {numbered ? (
      <Text
        style={styles.footerLightText}
        render={({ pageNumber, totalPages }) =>
          t("reportGeneration:footer:page", { pageNumber, totalPages })
        }
      />
    ) : (
      <Text />
    )}
    <Text style={styles.footerLightText}>
      {t("reportGeneration:phrases:analysisPerformedBy")}{" "}
      <ImagePDF
        src={assetUrl("/images/Logo.png")}
        style={styles.footerLogoImage}
      />
    </Text>
  </View>
);

const PageTitle = ({
  eyebrow,
  children,
}: {
  eyebrow?: string;
  children: string;
}) => (
  <View style={styles.pageTitleContainer}>
    {!!eyebrow && <Text style={styles.eyebrowText}>{eyebrow.toUpperCase()}</Text>}
    <Text style={styles.pageTitleText}>{children}</Text>
  </View>
);

const ResultChip = ({
  resultClass,
  children,
}: {
  resultClass: ResultClass;
  children: string;
}) => (
  <View
    style={[
      styles.resultChip,
      { backgroundColor: resultClassBackgroundColor(resultClass) },
    ]}
  >
    <Text style={{ color: resultClassColor(resultClass) }}>
      {children.toUpperCase()}
    </Text>
  </View>
);

const CategoryDot = ({ category }: { category: LayerCategory | null }) => (
  <View
    style={[styles.categoryDot, { backgroundColor: categoryColor(category) }]}
  />
);

export const CoverPage = ({
  farmsData,
  groups,
  t,
  language,
}: {
  farmsData: FarmData[];
  groups: CategoryGroup<ReportLayer>[];
  t: TFunction;
  language?: string;
}) => {
  const associationText = getCommaSeparatedUniqueTexts(
    pluck(farmsData, "association")
  );
  const countryText = getCommaSeparatedUniqueTexts(pluck(farmsData, "country"));
  const index = [
    ["farmSheets", REPORT_ANCHORS.farmSheets],
    ["methodology", REPORT_ANCHORS.methodology],
    ["scope", REPORT_ANCHORS.scope],
  ] as const;

  return (
    <Page size="A4" style={styles.coverPage}>
      <View style={styles.coverPageBackgroundImageContainer}>
        <ImagePDF
          src={assetUrl("/images/deforestationReportCoverBackground.png")}
          style={styles.coverPageBackgroundImage}
        />
      </View>

      <View style={styles.coverPageBackgroundWhiteImageContainer}>
        <ImagePDF
          src={assetUrl("/images/deforestationReportCoverBackgroundWhite.png")}
          style={styles.coverPageBackgroundWhiteImage}
        />
      </View>

      <View style={styles.coverPageBackgroundLeafImageContainer}>
        <ImagePDF
          src={assetUrl("/images/deforestationReportCoverBackgroundLeaf.png")}
          style={styles.coverPageBackgroundLeafImage}
        />
      </View>

      <View style={styles.coverPageSection}>
        <View style={styles.coverTitleSection}>
          <Text style={styles.coverTitleText}>
            {t("reportGeneration:coverPage:titleFirstLine")}
          </Text>
          <Text style={styles.coverTitleText}>
            {t("reportGeneration:coverPage:titleSecondLine")}
          </Text>
        </View>
        {!!associationText && (
          <Text style={styles.coverRowText}>
            {t("reportGeneration:words:association")}:{" "}
            <Text style={styles.coverBoldText}>{associationText}</Text>
          </Text>
        )}
        {!!countryText && (
          <Text style={styles.coverRowText}>
            {t("reportGeneration:phrases:originCountry")}:{" "}
            <Text style={styles.coverBoldText}>{countryText}</Text>
          </Text>
        )}
        <Text style={styles.coverRowText}>
          {t("reportGeneration:phrases:reportDate")}:{" "}
          <Text style={styles.coverBoldText}>
            {longFormatDateByLanguage(new Date(), language)}
          </Text>
        </Text>
        <Text style={styles.coverRowText}>
          {t("reportGeneration:coverPage:polygons")}:{" "}
          <Text style={styles.coverBoldText}>{farmsData.length}</Text>
        </Text>

        <View style={styles.coverIncludes}>
          <Text style={styles.coverIncludesTitle}>
            {t("reportGeneration:coverPage:includesTitle").toUpperCase()}
          </Text>
          <View style={styles.coverCategories}>
            {groups.map(({ category, layers }) => (
              <View
                key={category?.id ?? "no-category"}
                style={styles.coverCategoryChip}
              >
                <CategoryDot category={category} />
                <Text>
                  {categoryName(category, t, language)}
                  <Text style={styles.coverCategoryCount}>
                    {" · "}
                    {t("reportGeneration:coverPage:layerCount", {
                      count: layers.length,
                    })}
                  </Text>
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.coverIncludesTitle}>
            {t("reportGeneration:coverPage:indexTitle").toUpperCase()}
          </Text>
          {index.map(([key, anchor], i) => (
            <Link key={key} src={`#${anchor}`} style={styles.coverIndexLink}>
              {`${i + 1}. ${t(`reportGeneration:coverPage:index:${key}`)}`}
            </Link>
          ))}
        </View>
      </View>
      <Footer t={t} numbered={false} />
    </Page>
  );
};

const DataItem = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.dataItem}>
    <Text style={styles.lightText}>{label}</Text>
    <Text style={styles.boldText}>{value}</Text>
  </View>
);

const farmArea = (farm: FarmData, t: TFunction, language?: string) =>
  // -1 (or null) means the area could not be computed: never print it as a value.
  farm.polygon.area && farm.polygon.area > 0
    ? parseAreaToHectares(farm.polygon.area, 2, false, language)
    : t("common:na");

const LayerResultRow = ({
  layer,
  result,
  t,
}: {
  layer: ReportLayer;
  result: LayerResult;
  t: TFunction;
}) => (
  <View style={styles.layerResultRow} wrap={false}>
    <View style={styles.layerResultName}>
      <Text style={styles.boldText}>{layerLabel(layer.map)}</Text>
      <Text style={styles.smallLightText}>{layerPeriod(layer.map, t)}</Text>
    </View>
    <View style={styles.layerResultFinding}>
      {result.finding !== null && (
        <>
          <Text style={styles.smallLightText}>
            {t("reportGeneration:farmSheet:finding")}
          </Text>
          <Text style={styles.boldText}>{result.findingText}</Text>
        </>
      )}
    </View>
    <ResultChip resultClass={result.resultClass}>{result.label}</ResultChip>
  </View>
);

export const FarmSheetPage = ({
  farm,
  groups,
  categories,
  t,
  language,
  showLinks = true,
  anchor = false,
}: {
  farm: FarmData;
  groups: CategoryGroup<ReportLayer>[];
  categories: LayerCategory[];
  t: TFunction;
  language?: string;
  showLinks?: boolean;
  /** The first farm's sheet: the target of the cover's index. */
  anchor?: boolean;
}) => {
  const results = groups.map(({ category, layers }) => ({
    category,
    layers: layers.map((layer) => ({
      layer,
      result: layerResult(valueOf(layer, farm), category, t, language),
    })),
  }));
  const classes = results.map(({ layers }) =>
    categoryClass(layers.map(({ result }) => result.resultClass))
  );
  const okCategories = classes.filter((c) => c === "ok").length;

  const geojsonData = generateGeoJsonFarmsDataWithDeforestationAnalysis(
    [farm],
    groups.flatMap(({ layers }) => layers.map(({ results }) => results)),
    groups.flatMap(({ layers }) => layers.map(({ map }) => map)),
    categories,
    t,
    language
  );
  const geojsonString = encodeURIComponent(JSON.stringify(geojsonData));
  const producer =
    !!farm.producerId && !!farm.producer
      ? `${farm.producerId} / ${farm.producer}`
      : farm.producerId || farm.producer || t("common:na");
  const place =
    !!farm.country && !!farm.region
      ? `${farm.country} / ${farm.region}`
      : farm.country || farm.region || t("common:na");

  return (
    <Page size="A4" style={styles.contentPage}>
      <View id={anchor ? REPORT_ANCHORS.farmSheets : undefined}>
        <PageTitle eyebrow={t("reportGeneration:farmSheet:eyebrow")}>
          {`${t("reportGeneration:words:polygon")} n°${farm.id}`}
        </PageTitle>
      </View>

      <View style={styles.card}>
        <View style={styles.dataGrid}>
          <DataItem label={t("reportGeneration:attributes:id")} value={farm.id} />
          <DataItem
            label={t("reportGeneration:attributes:producer")}
            value={producer}
          />
          <DataItem
            label={t("reportGeneration:attributes:cropType")}
            value={farm.cropType || t("common:na")}
          />
          <DataItem
            label={t("reportGeneration:attributes:production")}
            value={
              farm.production
                ? `${farm.production} ${farm.productionQuantityUnit ?? ""}`.trim()
                : t("common:na")
            }
          />
          <DataItem
            label={t("reportGeneration:attributes:productionDate")}
            value={
              farm.productionDate
                ? shortFormatDateByLanguage(farm.productionDate, language ?? "en")
                : t("common:na")
            }
          />
          <DataItem
            label={`${t("reportGeneration:attributes:country")} / ${t(
              "reportGeneration:attributes:region"
            )}`}
            value={place}
          />
          <DataItem
            label={t("reportGeneration:attributes:totalArea")}
            value={farmArea(farm, t, language)}
          />
        </View>
      </View>

      <View style={[styles.card, styles.cardRow]}>
        <Text style={styles.sectionTitleText}>
          {t("reportGeneration:words:coordinates")}
        </Text>
        <Link
          src={`${DOWNLOAD_GEOJSON_URL}?content=${geojsonString}`}
          style={styles.blueLink}
        >
          {t("reportGeneration:phrases:downloadGeojson").toUpperCase()}
        </Link>
      </View>

      <View style={[styles.card, styles.cardRow]}>
        <Text style={styles.sectionTitleText}>
          {t("reportGeneration:words:documentation")}
        </Text>
        <View style={styles.documents}>
          {farm.documents.map((document, index) =>
            showLinks ? (
              <Link
                key={`${farm.id}-document-${index}-link`}
                src={document.url}
                style={styles.blueLink}
              >
                {document.name ??
                  t("reportGeneration:farmSheet:document", {
                    number: index + 1,
                  })}
              </Link>
            ) : (
              <Text key={`${farm.id}-document-${index}-text`}>
                {document.name ??
                  t("reportGeneration:farmSheet:document", {
                    number: index + 1,
                  })}
              </Text>
            )
          )}
          {!farm.documents.length && (
            <Text style={styles.lightText}>
              {t("reportGeneration:phrases:noDocumentation")}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.resultsHeader}>
        <Text style={styles.sectionHeadingText}>
          {t("reportGeneration:farmSheet:resultsTitle")}
        </Text>
        <Text style={styles.smallLightText}>
          {t("reportGeneration:farmSheet:categoriesWithoutFindings", {
            ok: okCategories,
            count: results.length,
          })}
        </Text>
      </View>

      {results.map(({ category, layers }, i) => {
        const resultClass = classes[i];
        const label =
          category && resultClass !== "unknown"
            ? localizedText(category.resultLabels[resultClass], language)
            : t("common:layerResults:noData");
        return (
          <View
            key={category?.id ?? "no-category"}
            style={[
              styles.categoryCard,
              { borderLeftColor: categoryColor(category) },
            ]}
            wrap={false}
          >
            <View style={styles.categoryCardHeader}>
              <CategoryDot category={category} />
              <Text style={styles.sectionTitleText}>
                {categoryName(category, t, language)}
              </Text>
              <View style={{ marginLeft: "auto" }}>
                <ResultChip resultClass={resultClass}>{label}</ResultChip>
              </View>
            </View>
            {layers.map(({ layer, result }) => (
              <LayerResultRow
                key={layer.map.id}
                layer={layer}
                result={result}
                t={t}
              />
            ))}
          </View>
        );
      })}

      <Footer t={t} />
    </Page>
  );
};

export const MapPage = ({
  farm,
  layer,
  t,
  language,
  imageBlobUrl,
  satelliteBackground,
}: {
  farm: FarmData;
  layer: ReportLayer;
  t: TFunction;
  language?: string;
  imageBlobUrl: string | null;
  satelliteBackground: boolean;
}) => {
  const result = layerResult(valueOf(layer, farm), layer.category, t, language);
  return (
    <Page size="A4" style={styles.contentPage}>
      <PageTitle eyebrow={t("reportGeneration:mapPage:eyebrow")}>
        {`${t("reportGeneration:words:polygon")} n°${farm.id}`}
      </PageTitle>
      <View
        style={[
          styles.categoryCard,
          { borderLeftColor: categoryColor(layer.category) },
        ]}
      >
        <View style={styles.categoryCardHeader}>
          <CategoryDot category={layer.category} />
          <Text style={styles.sectionTitleText}>
            {categoryName(layer.category, t, language)}
          </Text>
        </View>
        <LayerResultRow layer={layer} result={result} t={t} />
      </View>

      {!!imageBlobUrl && (
        <View style={styles.mapImageContainer}>
          {/* Not cached: each farm's image is used once. @react-pdf keeps only its
              last 30 images, so caching these pushed the cover's PNGs out, and
              decoding a PNG starts a new worker (png-js → fflate's async unzlib):
              a large report's ZIP started ~10 workers per farm. */}
          <ImagePDF
            src={imageBlobUrl}
            style={styles.mapImage}
            cache={false}
          />
          <Text style={styles.captionText}>
            {t("reportGeneration:mapPage:legend")}
          </Text>
          {satelliteBackground && (
            <Text style={styles.captionText}>
              {t("reportGeneration:mapPage:satelliteDisclaimer")}
            </Text>
          )}
        </View>
      )}

      <Footer t={t} />
    </Page>
  );
};

export const AppendixPageTableRow = ({
  children,
  extraStyles = {
    main: [],
    leftCell: [],
    rightCell: [],
  },
}: {
  children: [React.ReactNode, React.ReactNode];
  extraStyles?: {
    main?: Styles[];
    leftCell?: Styles[];
    rightCell?: Styles[];
  };
}) => {
  if (children.length !== 2) {
    throw new Error("AppendixPageTableRow must have exactly two children");
  }

  return (
    <View
      style={[styles.appendixPageTableRow, ...(extraStyles.main ?? [])]}
      wrap={false}
    >
      <View style={[styles.appendixPageTableLeftCell]}>{children[0]}</View>
      <View style={[styles.appendixPageTableRightCell]}>{children[1]}</View>
    </View>
  );
};

const TableRow = ({
  cells,
  widths,
  header = false,
}: {
  cells: React.ReactNode[];
  widths: string[];
  header?: boolean;
}) => (
  <View
    style={[styles.tableRow, header ? styles.tableHeaderRow : {}]}
    wrap={false}
  >
    {cells.map((cell, i) => (
      <View key={i} style={[styles.tableCell, { width: widths[i] }]}>
        {typeof cell === "string" ? (
          <Text style={header ? styles.tableHeaderText : undefined}>{cell}</Text>
        ) : (
          cell
        )}
      </View>
    ))}
  </View>
);

export const MethodologyPage = ({
  groups,
  t,
  language,
}: {
  groups: CategoryGroup<ReportLayer>[];
  t: TFunction;
  language?: string;
}) => {
  const m = (key: string) => t(`reportGeneration:methodology:${key}`);
  const categoryWidths = ["24%", "30%", "14%", "32%"];
  const layerWidths = ["26%", "16%", "30%", "12%", "16%"];
  return (
    <Page size="A4" style={styles.contentPage}>
      <View id={REPORT_ANCHORS.methodology}>
        <PageTitle eyebrow={m("title")}>{m("subtitle")}</PageTitle>
      </View>

      <Text style={styles.bodyText}>{m("formulaText")}</Text>
      <View style={styles.formulaBox}>
        <Text style={styles.formulaLabel}>{m("formulaLabel")}</Text>
        <Text style={styles.formulaSign}>=</Text>
        <View style={styles.formulaFraction}>
          <Text>{m("formulaNumerator")}</Text>
          <View style={styles.formulaBar} />
          <Text>{m("formulaDenominator")}</Text>
        </View>
        <Text style={styles.formulaSign}>× 100</Text>
      </View>

      <Text style={styles.sectionHeadingText}>{m("findingTitle")}</Text>
      <Text style={styles.bodyText}>{m("findingAvoid")}</Text>
      <Text style={styles.bodyText}>{m("findingRequired")}</Text>
      <Text style={styles.bodyText}>{m("thresholdText")}</Text>
      <Text style={styles.bodyText}>{m("noDataText")}</Text>

      <Text style={styles.sectionHeadingText}>{m("categoriesTitle")}</Text>
      <View style={styles.table}>
        <TableRow
          header
          widths={categoryWidths}
          cells={[
            t("reportGeneration:words:category"),
            m("findingColumn"),
            m("thresholdColumn"),
            m("resultsColumn"),
          ]}
        />
        {groups.map(({ category }) => (
          <TableRow
            key={category?.id ?? "no-category"}
            widths={categoryWidths}
            cells={[
              <View key="name" style={styles.inlineRow}>
                <CategoryDot category={category} />
                <Text style={styles.boldText}>
                  {categoryName(category, t, language)}
                </Text>
              </View>,
              category ? (
                <View key="finding">
                  <Text style={styles.boldText}>
                    {m(
                      category.polarity === "avoid"
                        ? "polarityAvoid"
                        : "polarityRequired"
                    )}
                  </Text>
                  <Text style={styles.smallLightText}>
                    {localizedText(category.description, language)}
                  </Text>
                </View>
              ) : (
                m("noCategoryText")
              ),
              category
                ? formatThreshold(category.thresholdPercentage, language ?? "es")
                : t("common:na"),
              category ? (
                <View key="labels" style={styles.labelsCell}>
                  <ResultChip resultClass="ok">
                    {localizedText(category.resultLabels.ok, language)}
                  </ResultChip>
                  <ResultChip resultClass="flagged">
                    {localizedText(category.resultLabels.flagged, language)}
                  </ResultChip>
                </View>
              ) : (
                t("common:layerResults:noData")
              ),
            ]}
          />
        ))}
      </View>

      <Text style={styles.sectionHeadingText}>{m("layersTitle")}</Text>
      <View style={styles.table}>
        <TableRow
          header
          widths={layerWidths}
          cells={[
            t("reportGeneration:words:layer"),
            t("reportGeneration:words:category"),
            t("deforestationAnalysis:mapsInfoModal:source"),
            m("periodColumn"),
            t("deforestationAnalysis:mapsInfoModal:resolution"),
          ]}
        />
        {groups.flatMap(({ category, layers }) =>
          layers.map(({ map }) => (
            <TableRow
              key={map.id}
              widths={layerWidths}
              cells={[
                layerLabel(map),
                categoryName(category, t, language),
                map.source ?? t("common:na"),
                layerPeriod(map, t),
                map.resolution ?? t("common:na"),
              ]}
            />
          ))
        )}
      </View>

      <Footer t={t} />
    </Page>
  );
};

const SCOPE_ATTRIBUTES = [
  "coverage",
  "source",
  "resolution",
  "contentDate",
  "updateFrequency",
  "publishDate",
  "references",
] as const;

/** One page per selected layer, also when all its results are null. */
export const LayerScopePages = ({
  groups,
  t,
  language,
  showLinks = true,
}: {
  groups: CategoryGroup<ReportLayer>[];
  t: TFunction;
  language?: string;
  showLinks?: boolean;
}) =>
  groups
    .flatMap(({ category, layers }) => layers.map((layer) => ({ category, layer })))
    .map(({ category, layer: { map } }, layerIndex) => (
      <Page size="A4" style={styles.contentPage} key={map.id}>
        <View id={layerIndex === 0 ? REPORT_ANCHORS.scope : undefined}>
          <PageTitle eyebrow={t("reportGeneration:scope:title")}>
            {layerLabel(map)}
          </PageTitle>
        </View>
        <View style={[styles.inlineRow, { marginBottom: 12 }]}>
          <CategoryDot category={category} />
          <Text>
            {t("reportGeneration:words:category")}:{" "}
            <Text style={styles.boldText}>
              {categoryName(category, t, language)}
            </Text>
          </Text>
        </View>

        <View>
          {SCOPE_ATTRIBUTES.map((attribute, idx) => (
            <AppendixPageTableRow
              key={`${map.id}-${attribute}`}
              extraStyles={{
                main: [
                  styles.mapsExplanationPageTableRow,
                  idx === 0
                    ? styles.appendixPageTableFirstRow
                    : idx === SCOPE_ATTRIBUTES.length - 1
                    ? styles.appendixPageTableLastRow
                    : {},
                ],
              }}
            >
              <Text>{t(`deforestationAnalysis:mapsInfoModal:${attribute}`)}</Text>
              {attribute === "references" ? (
                <View>
                  {map.references.length > 0 ? (
                    map.references.map((reference, i) =>
                      showLinks ? (
                        <Link
                          key={`${map.id}-reference-link-${i}`}
                          src={reference}
                          style={[styles.blueLink, { marginTop: i === 0 ? 0 : 10 }]}
                        >
                          {reference}
                        </Link>
                      ) : (
                        <Text key={`${map.id}-reference-text-${i}`}>-</Text>
                      )
                    )
                  ) : (
                    <Text>{t("common:na")}</Text>
                  )}
                </View>
              ) : (
                <Text>{map[attribute] ?? t("common:na")}</Text>
              )}
            </AppendixPageTableRow>
          ))}

          <Text style={styles.appendixPageSubtitleText}>
            {t(`deforestationAnalysis:mapsInfoModal:considerations`)}
          </Text>
          <View style={styles.appendixPageBodyText}>
            {map.considerations ? (
              <Considerations considerations={map.considerations} />
            ) : (
              <Text>{t("common:na")}</Text>
            )}
          </View>
        </View>
        <Footer t={t} />
      </Page>
    ));
