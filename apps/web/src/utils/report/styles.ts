import { StyleSheet } from "@react-pdf/renderer";

// The map page's image: the A4 width (595.28 pt) minus the page's padding, in the
// aspect ratio of the API's images (MapDefaults.OUTPUT_SIZE, 640×420). With another
// ratio the farm would be cut or banded.
const MAP_IMAGE_WIDTH = 595.28 - 2 * 30;
const MAP_IMAGE_HEIGHT = (MAP_IMAGE_WIDTH * 420) / 640;

export const styles = StyleSheet.create({
  document: {
    fontFamily: "Roboto",
    letterSpacing: 0.15,
  },
  coverPage: {
    fontSize: 16,
    fontWeight: 500,
    color: "#3A3541",
    position: "relative",
  },
  coverPageBackgroundImageContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
  },
  coverPageBackgroundImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  coverPageBackgroundLeafImageContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "75%",
    height: "auto",
  },
  coverPageBackgroundLeafImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  coverPageBackgroundWhiteImageContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "95%",
  },
  coverPageBackgroundWhiteImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  coverPageSection: {
    display: "flex",
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    position: "relative",
    padding: 30,
  },
  coverTitleSection: {
    display: "flex",
    flexDirection: "column",
    marginBottom: 20,
  },
  coverTitleText: {
    fontSize: 48,
  },
  coverRowText: {
    fontWeight: 400,
    marginBottom: 8,
  },
  coverBoldText: {
    fontWeight: 500,
  },
  contentPage: {
    fontSize: 11,
    color: "#3A3541",
    padding: 30,
    // Room for the fixed footer on pages that wrap
    paddingBottom: 60,
  },
  pageTitleContainer: {
    marginBottom: 14,
  },
  eyebrowText: {
    fontSize: 9,
    fontWeight: 500,
    letterSpacing: 1,
    color: "#1F6F8B",
    marginBottom: 4,
  },
  pageTitleText: {
    fontSize: 18,
    fontWeight: 500,
  },
  card: {
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#DEDEDE",
    borderRadius: 5,
    padding: "8px 10px",
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dataGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dataItem: {
    width: "33.33%",
    paddingVertical: 4,
    paddingRight: 8,
  },
  documents: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 12,
    maxWidth: "70%",
  },
  sectionTitleText: {
    fontWeight: 500,
  },
  sectionHeadingText: {
    fontSize: 13,
    fontWeight: 500,
    marginTop: 12,
    marginBottom: 8,
  },
  lightText: {
    color: "#000000",
    fontWeight: 400,
    opacity: 0.6,
  },
  smallLightText: {
    fontSize: 9,
    color: "#000000",
    fontWeight: 400,
    opacity: 0.6,
  },
  boldText: {
    color: "#000000",
    fontWeight: 500,
    opacity: 0.87,
  },
  bodyText: {
    lineHeight: "15px",
    marginBottom: 5,
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  categoryCard: {
    borderWidth: 1,
    borderColor: "#DEDEDE",
    borderLeftWidth: 4,
    borderRadius: 5,
    marginBottom: 8,
  },
  categoryCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: "6px 10px",
    backgroundColor: "#FAFAFA",
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  layerResultRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: "6px 10px",
    borderTop: "1px solid #EEEEEE",
  },
  layerResultName: {
    flex: 1,
    paddingRight: 8,
  },
  layerResultFinding: {
    width: 70,
    alignItems: "flex-end",
    marginRight: 10,
  },
  resultChip: {
    borderRadius: 10,
    padding: "3px 8px",
    fontSize: 8,
    fontWeight: 500,
    alignSelf: "flex-start",
  },
  blueLink: {
    color: "#0D6EFD",
    textDecoration: "underline",
  },
  mapImageContainer: {
    marginTop: 6,
    width: "100%",
  },
  mapImage: {
    width: MAP_IMAGE_WIDTH,
    height: MAP_IMAGE_HEIGHT,
    // Never crops: if the ratios drift, the image gets bands, not a cut farm.
    objectFit: "contain",
  },
  captionText: {
    fontSize: 9,
    marginTop: 5,
    opacity: 0.6,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  formulaBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1F3A4D",
    color: "#FFFFFF",
    borderRadius: 6,
    padding: "12px 16px",
    marginVertical: 8,
  },
  formulaLabel: {
    fontWeight: 500,
  },
  formulaSign: {
    marginHorizontal: 10,
  },
  formulaFraction: {
    alignItems: "center",
    fontSize: 10,
  },
  formulaBar: {
    height: 1,
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
    marginVertical: 3,
  },
  table: {
    borderWidth: 1,
    borderColor: "#DEDEDE",
    borderRadius: 5,
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    borderTop: "1px solid #EEEEEE",
  },
  tableHeaderRow: {
    backgroundColor: "#F5F5F5",
    borderTop: "none",
  },
  tableHeaderText: {
    fontWeight: 500,
  },
  tableCell: {
    padding: "5px 6px",
  },
  labelsCell: {
    gap: 3,
  },
  coverIncludes: {
    marginTop: 18,
    fontSize: 12,
  },
  coverIncludesTitle: {
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 8,
  },
  coverCategories: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  coverCategoryChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DEDEDE",
    borderRadius: 12,
    padding: "4px 10px",
    fontWeight: 400,
  },
  coverCategoryCount: {
    opacity: 0.6,
  },
  coverIndexLink: {
    color: "#3A3541",
    fontWeight: 400,
    textDecoration: "none",
    marginBottom: 4,
  },
  appendixPageSubtitleText: {
    fontSize: 14,
    fontWeight: 500,
    marginTop: 20,
    marginBottom: 12,
  },
  appendixPageBodyText: {
    fontWeight: 400,
    lineHeight: "23px",
  },
  appendixPageTableRow: {
    border: "0.8px solid #DEDEDE",
    display: "flex",
    flexDirection: "row",
  },
  mapsExplanationPageTableRow: {
    minHeight: 60,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  appendixPageTableFirstRow: {
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  appendixPageTableLastRow: {
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  appendixPageTableLeftCell: {
    backgroundColor: "#F9F9F9",
    padding: "8px",
    flex: 1,
    display: "flex",
    justifyContent: "center",
    fontWeight: 500,
  },
  appendixPageTableRightCell: {
    padding: "8px 10px",
    flex: 2,
    display: "flex",
    justifyContent: "center",
    lineHeight: "18px",
  },
  footer: {
    position: "absolute",
    bottom: 20, // Distance from the bottom edge
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    fontSize: 10,
  },
  footerLightText: {
    color: "#000000",
    fontWeight: 400,
    opacity: 0.6,
  },
  footerLogoImage: {
    width: "100px",
    height: "20px",
  },
});
