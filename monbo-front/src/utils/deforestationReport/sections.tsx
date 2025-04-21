import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import { FarmData } from "@/interfaces/Farm";
import { Page, Text, View, Link, Image as ImagePDF } from "@react-pdf/renderer";
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

const Footer = ({ t }: { t: TFunction }) => (
  <View style={styles.footer}>
    <Text style={styles.footerLightText}>
      {t("reportGeneration:phrases:analysisPerformedBy")}{" "}
      <ImagePDF src={"/images/Logo.png"} style={styles.footerLogoImage} />
    </Text>
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

      <View style={styles.coverPageBackgroundONUImageContainer}>
        <ImagePDF
          src={"/images/deforestationReportCoverBackgroundOnuLogo.png"}
          style={styles.coverPageBackgroundONULogoImage}
        />
      </View>
      <View style={styles.coverPageSection}>
        <View style={styles.coverTitleSection}>
          <Text style={styles.coverTitleText}>
            {language === "es" ? "Reporte Análisis" : "Deforestation"}
          </Text>
          <Text style={styles.coverTitleText}>
            {language === "es" ? "Deforestación" : "Analysis Report"}
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
              src={`http://localhost:8000/download-geojson?content=${geojsonString}`}
              style={styles.farmMapPageBlueLink}
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
                style={styles.farmMapPageBlueLink}
              >
                {document.name ?? `Documento ${index + 1}`}
              </Link>
            ))}
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

export const DeforestationExplanationPage = ({ t }: { t: TFunction }) => {
  const withoutDeforestationColor = getDeforestationPercentageChipColor(0);
  const withDeforestationColor = getDeforestationPercentageChipColor(1);

  const withoutDeforestationBackgroundColor =
    getDeforestationPercentageChipBackgroundColor(0);
  const withDeforestationBackgroundColor =
    getDeforestationPercentageChipBackgroundColor(1);

  return (
    <Page size="A4" style={styles.deforestationExplanationPage}>
      <View style={styles.deforestationExplanationPageTitleContainer}>
        <Text style={styles.deforestationExplanationPageTitleText}>
          Cálculo de deforestación
        </Text>
      </View>
      <View style={styles.deforestationExplanationPageBodyContainer}>
        <Text style={styles.deforestationExplanationPageSubtitleText}>
          Fórmula utilizada
        </Text>
        <Text style={styles.deforestationExplanationPageBodyText}>
          La fórmula para calcular el porcentaje de deforestación considera la
          razón entre el área de un polígono y lorem ipsum dolor sit amet,
          consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
          labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
          exercitation
        </Text>
        <Text style={styles.deforestationExplanationPageSubtitleText}>
          Estados de deforestación
        </Text>
        <View
          style={[
            styles.deforestationExplanationPageTableRow,
            styles.deforestationExplanationPageTableFirstRow,
          ]}
        >
          <View style={[styles.deforestationExplanationPageTableLeftCell]}>
            <View
              style={[
                styles.deforestationExplanationPageTableLeftCellChip,
                { backgroundColor: withoutDeforestationBackgroundColor },
              ]}
            >
              <Text style={[{ color: withoutDeforestationColor }]}>
                LIBRE DEFORESTACIÓN
              </Text>
            </View>
          </View>
          <View style={styles.deforestationExplanationPageTableRightCell}>
            <Text>
              Indica que no ha habido intervención que haya provocado la
              reducción del bosque natural dentro del polígono evaluado, de
              acuerdo con los mapas oficiales o metodologías reconocidas.
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.deforestationExplanationPageTableRow,
            styles.deforestationExplanationPageTableLastRow,
          ]}
        >
          <View style={styles.deforestationExplanationPageTableLeftCell}>
            <View
              style={[
                styles.deforestationExplanationPageTableLeftCellChip,
                { backgroundColor: withDeforestationBackgroundColor },
              ]}
            >
              <Text style={[{ color: withDeforestationColor }]}>
                XX% DEFORESTACIÓN
              </Text>
            </View>
          </View>
          <View style={styles.deforestationExplanationPageTableRightCell}>
            <Text>
              Cuantifica el grado de deforestación o pérdida de cobertura
              boscosa del polígono evaluado, de acuerdo con el mapa de
              referencia utilizado
            </Text>
          </View>
        </View>
      </View>
      {/* Footer */}
      <Footer t={t} />
    </Page>
  );
};

export const MapDescriptionPage = ({
  deforestationAnalysisResults,
  mapsData,
}: {
  deforestationAnalysisResults: DeforestationAnalysisMapResults[];
  mapsData: MapData[];
}) => {
  return deforestationAnalysisResults
    .map((mapResults) => {
      // Hide explanation if all the results are not defined
      if (mapResults.farmResults.every((r) => r.value === null)) return null;

      const map = mapsData.find((m) => m.id === mapResults.mapId)!;
      return (
        <Page size="A4" style={styles.farmMapPage} key={mapResults.mapId}>
          <View style={styles.farmMapPageSection}>
            <Text>Mapas utilizados para el análisis de deforestación</Text>
            <Text>{map.name}</Text>
          </View>
        </Page>
      );
    })
    .filter(Boolean);
};
