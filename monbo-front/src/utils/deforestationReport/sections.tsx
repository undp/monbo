import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import { FarmData } from "@/interfaces/Farm";
import {
  Page,
  Text,
  View,
  Link,
  Image as ImagePDF,
  Styles,
} from "@react-pdf/renderer";
import { formatPercentage } from "../numbers";
import {
  getDeforestationPercentageChipBackgroundColor,
  getDeforestationPercentageChipColor,
} from "../styling";
import { upperCase, map } from "lodash";
import { TFunction } from "i18next";
import { generateGeoJsonFarmsDataWithDeforestationAnalysis } from "../geojson";
import { parseAreaToHectares } from "../polygons";
import { longFormatDateByLanguage, shortFormatDateByLanguage } from "../dates";
import { styles } from "./styles";
import { getCommaSeparatedUniqueTexts } from "@/utils/strings";
import { DOWNLOAD_GEOJSON_URL } from "@/config/env";

const Footer = ({ t }: { t: TFunction }) => (
  <View style={styles.footer}>
    <Text style={styles.footerLightText}>
      {t("reportGeneration:phrases:analysisPerformedBy")}{" "}
      <ImagePDF src={"/images/Logo.png"} style={styles.footerLogoImage} />
    </Text>
  </View>
);

const AppendixPageTitle = ({ children }: { children: string }) => (
  <View style={styles.appendixPageTitleContainer}>
    <Text style={styles.appendixPageTitleText}>{children}</Text>
  </View>
);

export const CoverPage = ({
  farmsData,
  t,
  language,
}: {
  farmsData: FarmData[];
  t: TFunction;
  language?: string;
}) => {
  const associationText = getCommaSeparatedUniqueTexts(
    map(farmsData, "association")
  );
  const countryText = getCommaSeparatedUniqueTexts(map(farmsData, "country"));

  return (
    <Page size="A4" style={styles.coverPage}>
      <View style={styles.coverPageBackgroundImageContainer}>
        <ImagePDF
          src={"/images/deforestationReportCoverBackground.png"}
          style={styles.coverPageBackgroundImage}
        />
      </View>

      <View style={styles.coverPageBackgroundWhiteImageContainer}>
        <ImagePDF
          src={"/images/deforestationReportCoverBackgroundWhite.png"}
          style={styles.coverPageBackgroundWhiteImage}
        />
      </View>

      <View style={styles.coverPageBackgroundLeafImageContainer}>
        <ImagePDF
          src={"/images/deforestationReportCoverBackgroundLeaf.png"}
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
        {/* Hidden for now, because we don't have a product in the data */}
        {/* <Text style={styles.coverRowText}>
            {t("reportGeneration:words:product")}:{" "}
            <Text style={styles.coverBoldText}>Café</Text>
          </Text> */}
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
      </View>
      {/* Footer */}
      <Footer t={t} />
    </Page>
  );
};

export const FarmMapPage = ({
  farm,
  map,
  result,
  t,
  language,
  imageBlobUrl,
}: {
  farm: FarmData;
  map: MapData;
  result: DeforestationAnalysisMapResults["farmResults"][number];
  t: TFunction;
  language?: string;
  imageBlobUrl: string | null;
}) => {
  const deforestationPercentage = result.value;
  // If the deforestation percentage is null, return null to avoid rendering the page
  if (deforestationPercentage === null) return null;

  // Format the deforestation text based on its value
  const deforestationText =
    deforestationPercentage === null
      ? t("common:na")
      : deforestationPercentage > 0
      ? `${formatPercentage(deforestationPercentage, 1, language)} ${t(
          "reportGeneration:words:deforestation"
        ).toUpperCase()}`
      : upperCase(t("reportGeneration:phrases:deforestationFree"));

  const deforestationColor = getDeforestationPercentageChipColor(
    deforestationPercentage
  );

  // Convert JSON to URL-encoded string
  const geojsonData = generateGeoJsonFarmsDataWithDeforestationAnalysis(
    [farm],
    [{ mapId: map.id, farmResults: [result] }],
    [map],
    language
  );
  const geojsonString = encodeURIComponent(
    JSON.stringify(geojsonData, null, 2)
  );

  return (
    // TODO: test if long text breaks the page
    <Page size="A4" style={styles.farmMapPage}>
      {/* Page title */}
      <View style={styles.farmMapPageSection}>
        <Text style={styles.farmMapPageTitleText}>
          {t("reportGeneration:words:polygon")} n°{farm.id}
        </Text>
      </View>
      {/* Header */}
      <View style={styles.farmMapPageSection}>
        <View style={styles.farmMapPageTable}>
          <View style={styles.farmMapPageRow}>
            <View style={styles.farmMapPageGrid}>
              <View style={styles.farmMapPageGridLeftItem}>
                <Text style={styles.farmMapPageSectionTitleText}>
                  {upperCase(t("reportGeneration:attributes:id"))}/
                  {t("reportGeneration:attributes:producer")}
                </Text>
              </View>
              <View style={styles.farmMapPageGridRightItem}>
                <Text style={styles.farmMapPageSectionTitleText}>
                  {!!farm.producerId && !!farm.producer
                    ? `${farm.producerId} / ${farm.producer}`
                    : farm.producerId || farm.producer || ""}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Product Section */}
      <View style={styles.farmMapPageSection}>
        <View style={styles.farmMapPageTable}>
          <View style={styles.farmMapPageRow}>
            <Text style={styles.farmMapPageSectionTitleText}>
              {t("reportGeneration:words:product")}
            </Text>
          </View>
          <View style={styles.farmMapPageDivider} />
          <View style={styles.farmMapPageRow}>
            <View style={styles.farmMapPageGrid}>
              <View style={styles.farmMapPageGridLeftItem}>
                <Text style={styles.farmMapPageLightText}>
                  {t("reportGeneration:attributes:cropType")}:{" "}
                  <Text style={styles.farmMapPageBoldText}>
                    {farm.cropType}
                  </Text>
                </Text>
              </View>
              <View style={styles.farmMapPageGridRightItem}>
                <Text style={styles.farmMapPageLightText}>
                  {t("reportGeneration:attributes:productionDate")}:{" "}
                  <Text style={styles.farmMapPageBoldText}>
                    {farm.productionDate
                      ? shortFormatDateByLanguage(
                          farm.productionDate,
                          language ?? "en"
                        )
                      : t("common:na")}
                  </Text>
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.farmMapPageRow}>
            <View style={styles.farmMapPageGrid}>
              <View style={styles.farmMapPageGridLeftItem}>
                <Text style={styles.farmMapPageLightText}>
                  {t("reportGeneration:attributes:production")}:{" "}
                  <Text style={styles.farmMapPageBoldText}>
                    {/* TODO: handle units different than (q) */}
                    {!!farm.production
                      ? `${farm.production} ${farm.productionQuantityUnit}`
                      : t("common:na")}
                  </Text>
                </Text>
              </View>
              <View style={styles.farmMapPageGridRightItem}>
                <Text style={styles.farmMapPageLightText}>
                  {t("reportGeneration:attributes:country")}/
                  {t("reportGeneration:attributes:region")}:{" "}
                  <Text style={styles.farmMapPageBoldText}>
                    {!!farm.country && !!farm.region
                      ? `${farm.country}/${farm.region}`
                      : farm.country || farm.region || ""}
                  </Text>
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Deforestation Analysis */}
      <View style={styles.farmMapPageSection}>
        <View style={styles.farmMapPageTable}>
          <View style={[styles.farmMapPageRow, styles.farmMapPageSpaceBetween]}>
            <Text style={styles.farmMapPageSectionTitleText}>
              {t("reportGeneration:phrases:deforestationAnalysis")}
            </Text>
            <Text
              style={[
                styles.farmMapPageDeforestationText,
                { color: deforestationColor },
              ]}
            >
              {deforestationText}
            </Text>
          </View>
          <View style={styles.farmMapPageDivider} />
          <View style={styles.farmMapPageRow}>
            <View style={styles.farmMapPageGrid}>
              <View style={styles.farmMapPageGridLeftItem}>
                <Text style={styles.farmMapPageLightText}>
                  {t("reportGeneration:attributes:totalArea")}:{" "}
                  <Text style={styles.farmMapPageBoldText}>
                    {parseAreaToHectares(farm.polygon.area, 2, false, language)}
                  </Text>
                </Text>
              </View>
              <View style={styles.farmMapPageGridRightItem}>
                <Text style={styles.farmMapPageLightText}>
                  {t("deforestationAnalysis:map")}:{" "}
                  <Text style={styles.farmMapPageBoldText}>{map.name}</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Coordinates */}
      <View style={styles.farmMapPageSection}>
        <View style={styles.farmMapPageTable}>
          <View style={[styles.farmMapPageRow, styles.farmMapPageSpaceBetween]}>
            <Text style={styles.farmMapPageSectionTitleText}>
              {t("reportGeneration:words:coordinates")}
            </Text>
            <Link
              src={`${DOWNLOAD_GEOJSON_URL}?content=${geojsonString}`}
              style={styles.blueLink}
            >
              {t("reportGeneration:phrases:downloadGeojson").toUpperCase()}
            </Link>
          </View>
        </View>
      </View>

      {/* Documentation */}
      <View style={styles.farmMapPageSection}>
        <View style={styles.farmMapPageTable}>
          <View style={styles.farmMapPageRow}>
            <Text style={styles.farmMapPageSectionTitleText}>
              {t("reportGeneration:words:documentation")}
            </Text>
          </View>
          <View style={styles.farmMapPageDivider} />
          <View style={[styles.farmMapPageRow, styles.farmMapPageSpaceEvenly]}>
            {farm.documents.map((document, index) => (
              <Link
                key={`${farm.id}-document-${index}`}
                src={document.url}
                style={styles.blueLink}
              >
                {document.name ?? `Documento ${index + 1}`}
              </Link>
            ))}
            {!farm.documents.length && (
              <Text style={styles.farmMapPageLightText}>
                {t("reportGeneration:phrases:noDocumentation")}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Map Image */}
      {!!imageBlobUrl && (
        <View style={styles.farmMapPageMapImageContainer}>
          <ImagePDF src={imageBlobUrl} style={styles.farmMapPageMapImage} />
        </View>
      )}

      {/* Footer */}
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
    <View style={[styles.appendixPageTableRow, ...(extraStyles.main ?? [])]}>
      <View style={[styles.appendixPageTableLeftCell]}>{children[0]}</View>
      <View style={[styles.appendixPageTableRightCell]}>{children[1]}</View>
    </View>
  );
};

interface Segment {
  text: string;
  isBold: boolean;
  isItalic: boolean;
}

export const DeforestationExplanationPage = ({ t }: { t: TFunction }) => {
  const withoutDeforestationColor = getDeforestationPercentageChipColor(0);
  const withDeforestationColor = getDeforestationPercentageChipColor(1);

  const withoutDeforestationBackgroundColor =
    getDeforestationPercentageChipBackgroundColor(0);
  const withDeforestationBackgroundColor =
    getDeforestationPercentageChipBackgroundColor(1);

  return (
    <Page size="A4" style={styles.appendixPage}>
      <AppendixPageTitle>
        {t("reportGeneration:appendixPages:deforestationExplanation:title")}
      </AppendixPageTitle>
      <View style={styles.appendixPageBodyContainer}>
        <Text style={styles.appendixPageSubtitleText}>
          {t(
            "reportGeneration:appendixPages:deforestationExplanation:formulaSubtitle"
          )}
        </Text>
        <Text style={styles.appendixPageBodyText}>
          {t(
            "reportGeneration:appendixPages:deforestationExplanation:formulaText"
          )}
        </Text>
        <Text style={styles.appendixPageSubtitleText}>
          {t(
            "reportGeneration:appendixPages:deforestationExplanation:deforestationStatesSubtitle"
          )}
        </Text>
        <AppendixPageTableRow
          extraStyles={{
            main: [
              styles.deforestationExplanationPageTableRow,
              styles.appendixPageTableFirstRow,
            ],
            leftCell: [styles.deforestationExplanationPageTableLeftCell],
          }}
        >
          <View
            style={[
              styles.deforestationExplanationPageTableLeftCellChip,
              { backgroundColor: withoutDeforestationBackgroundColor },
            ]}
          >
            <Text style={[{ color: withoutDeforestationColor }]}>
              {t(
                "reportGeneration:appendixPages:deforestationExplanation:deforestationFreeText"
              )}
            </Text>
          </View>
          <Text>
            {t(
              "reportGeneration:appendixPages:deforestationExplanation:deforestationFreeExplanation"
            )}
          </Text>
        </AppendixPageTableRow>
        <AppendixPageTableRow
          extraStyles={{
            main: [
              styles.deforestationExplanationPageTableRow,
              styles.appendixPageTableLastRow,
            ],
            leftCell: [styles.deforestationExplanationPageTableLeftCell],
          }}
        >
          <View
            style={[
              styles.deforestationExplanationPageTableLeftCellChip,
              { backgroundColor: withDeforestationBackgroundColor },
            ]}
          >
            <Text style={[{ color: withDeforestationColor }]}>
              {t(
                "reportGeneration:appendixPages:deforestationExplanation:withDeforestationText"
              )}
            </Text>
          </View>
          <Text>
            {t(
              "reportGeneration:appendixPages:deforestationExplanation:withDeforestationExplanation"
            )}
          </Text>
        </AppendixPageTableRow>
      </View>
      {/* Footer */}
      <Footer t={t} />
    </Page>
  );
};

export const MapDescriptionPage = ({
  deforestationAnalysisResults,
  mapsData,
  t,
}: {
  deforestationAnalysisResults: DeforestationAnalysisMapResults[];
  mapsData: MapData[];
  t: TFunction;
}) => {
  return deforestationAnalysisResults
    .map((mapResults) => {
      // Hide explanation if all the results are not defined
      if (mapResults.farmResults.every((r) => r.value === null)) return null;

      const map = mapsData.find((m) => m.id === mapResults.mapId)!;

      const attributes = [
        "coverage",
        "source",
        "resolution",
        "contentDate",
        "updateFrequency",
        "publishDate",
        "references",
      ] as (keyof MapData)[];

      return (
        <Page size="A4" style={styles.appendixPage} key={mapResults.mapId}>
          <AppendixPageTitle>
            {t("reportGeneration:appendixPages:mapsExplanation:title")}
          </AppendixPageTitle>
          <Text style={styles.mapsExplanationMapNameText}>{map.name}</Text>

          <View style={styles.appendixPageBodyContainer}>
            {attributes.map((attribute, idx) => (
              <AppendixPageTableRow
                key={`${map.id}-${attribute}`}
                extraStyles={{
                  main: [
                    styles.mapsExplanationPageTableRow,
                    idx === 0
                      ? styles.appendixPageTableFirstRow
                      : idx === attributes.length - 1
                      ? styles.appendixPageTableLastRow
                      : undefined,
                  ],
                }}
              >
                <Text>
                  {t(`deforestationAnalysis:mapsInfoModal:${attribute}`)}
                </Text>
                {attribute === "references" && Array.isArray(map[attribute]) ? (
                  <View>
                    {map[attribute].length > 0 ? (
                      map[attribute].map((reference, idx) => (
                        <Link
                          key={`${map.id}-reference-${idx}`}
                          src={reference}
                          style={[
                            styles.blueLink,
                            { marginTop: idx === 0 ? 0 : 10 },
                          ]}
                        >
                          {reference}
                        </Link>
                      ))
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
            {/* Replace the ReactMarkdown component completely */}
            <View style={styles.appendixPageBodyText}>
              {map.considerations ? (
                // Split the content by lines and render each line properly
                map.considerations.split("\n").map((line, index) => {
                  // TODO: refactor to simplify or modularize this
                  // Check if the line is a heading (starts with ###)
                  const isHeading = line.trim().startsWith("### ");

                  // Check indentation level for list items
                  const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length ?? 0;
                  const indentationLevel = Math.floor(leadingSpaces / 2); // Assuming 2 spaces per indentation level

                  // Check if the line is a list item
                  const isListItem =
                    line.trim().startsWith("- ") || line.trim().match(/^\d+\./);

                  // Process content based on type
                  let content = line;
                  if (isHeading) {
                    content = line.trim().replace(/^### /, "");
                  } else if (isListItem) {
                    content = line
                      .trim()
                      .replace(/^- /, "")
                      .replace(/^\d+\./, "");
                  }

                  // Function to process formatting (bold and italic)
                  const renderFormattedText = (text: string) => {
                    // Split the text by bold and italic markers
                    const segments: Segment[] = [];
                    // let currentText = text;

                    // Process bold text (surrounded by **)
                    let boldMatch;
                    const boldRegex = /\*\*(.*?)\*\*/g;
                    let lastIndex = 0;

                    while ((boldMatch = boldRegex.exec(text)) !== null) {
                      // Add text before the bold section
                      if (boldMatch.index > lastIndex) {
                        segments.push({
                          text: text.substring(lastIndex, boldMatch.index),
                          isBold: false,
                          isItalic: false,
                        });
                      }

                      // Add the bold text
                      segments.push({
                        text: boldMatch[1], // The text inside ** markers
                        isBold: true,
                        isItalic: false,
                      });

                      lastIndex = boldMatch.index + boldMatch[0].length;
                    }

                    // Add any remaining text
                    if (lastIndex < text.length) {
                      segments.push({
                        text: text.substring(lastIndex),
                        isBold: false,
                        isItalic: false,
                      });
                    }

                    // If no bold text was found, just use the original text
                    if (segments.length === 0) {
                      segments.push({
                        text: text,
                        isBold: false,
                        isItalic: false,
                      });
                    }

                    // Process each segment for italic text (surrounded by _)
                    const finalSegments: Segment[] = [];
                    segments.forEach((segment) => {
                      const italicRegex = /_(.*?)_/g;
                      let italicMatch;
                      let italicLastIndex = 0;
                      const italicSegments: Segment[] = [];

                      while (
                        (italicMatch = italicRegex.exec(segment.text)) !== null
                      ) {
                        // Add text before the italic section
                        if (italicMatch.index > italicLastIndex) {
                          italicSegments.push({
                            text: segment.text.substring(
                              italicLastIndex,
                              italicMatch.index
                            ),
                            isBold: segment.isBold,
                            isItalic: false,
                          });
                        }

                        // Add the italic text
                        italicSegments.push({
                          text: italicMatch[1], // The text inside _ markers
                          isBold: segment.isBold,
                          isItalic: true,
                        });

                        italicLastIndex =
                          italicMatch.index + italicMatch[0].length;
                      }

                      // Add any remaining text
                      if (italicLastIndex < segment.text.length) {
                        italicSegments.push({
                          text: segment.text.substring(italicLastIndex),
                          isBold: segment.isBold,
                          isItalic: false,
                        });
                      }

                      // If no italic text was found, just use the original segment
                      if (italicSegments.length === 0) {
                        italicSegments.push(segment);
                      }

                      finalSegments.push(...italicSegments);
                    });

                    // Render all segments with appropriate styling
                    return finalSegments.map((segment, i) => (
                      <Text
                        key={i}
                        style={{
                          fontWeight: segment.isBold ? "bold" : "normal",
                          fontStyle: segment.isItalic ? "italic" : "normal",
                        }}
                      >
                        {segment.text}
                      </Text>
                    ));
                  };

                  if (isHeading) {
                    // Render headings with appropriate style
                    return (
                      <Text
                        key={index}
                        style={{
                          fontWeight: 700,
                          fontSize: 12,
                          marginTop: 8,
                          marginBottom: 5,
                        }}
                      >
                        {renderFormattedText(content)}
                      </Text>
                    );
                  } else if (isListItem) {
                    // Render list items with proper indentation
                    return (
                      <View
                        key={index}
                        style={{
                          flexDirection: "row",
                          marginBottom: 3,
                          paddingLeft: indentationLevel * 15, // Indent based on level
                        }}
                      >
                        <Text style={{ width: 15, marginRight: 5 }}>
                          {line.trim().startsWith("- ")
                            ? "•"
                            : line.trim().match(/^\d+\./)?.[0]
                            ? line.trim().match(/^\d+\./)?.[0]
                            : "•"}
                        </Text>
                        <Text style={{ flex: 1 }}>
                          {renderFormattedText(content)}
                        </Text>
                      </View>
                    );
                  } else {
                    // Render regular paragraphs
                    return (
                      <Text key={index} style={{ marginBottom: 5 }}>
                        {renderFormattedText(content)}
                      </Text>
                    );
                  }
                })
              ) : (
                <Text>{t("common:na")}</Text>
              )}
            </View>
          </View>
        </Page>
      );
    })
    .filter(Boolean);
};
