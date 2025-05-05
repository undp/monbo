import { StyleSheet } from "@react-pdf/renderer";

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
  farmMapPage: {
    fontSize: 12,
    padding: "30px",
    paddingBottom: 0,
  },
  farmMapPageSection: {
    marginBottom: 12,
  },
  farmMapPageTable: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#DEDEDE",
    borderRadius: 5,
  },
  farmMapPageRow: {
    flexDirection: "row",
    padding: "6px 8px",
  },
  farmMapPageSpaceBetween: {
    justifyContent: "space-between",
  },
  farmMapPageSpaceEvenly: {
    justifyContent: "space-evenly",
  },
  farmMapPageDivider: {
    height: 0,
    borderBottom: "1px solid #DEDEDE",
    margin: "0 8px",
  },
  farmMapPageGrid: {
    display: "flex",
    flexDirection: "row",
  },
  farmMapPageGridLeftItem: {
    width: "35%",
  },
  farmMapPageGridRightItem: {
    width: "65%",
  },
  farmMapPageTitleText: {
    fontSize: 16,
    fontWeight: 500,
    color: "#3A3541",
  },
  farmMapPageSectionTitleText: {
    color: "#3A3541",
    fontWeight: 500,
  },
  farmMapPageLightText: {
    color: "#000000",
    fontWeight: 400,
    opacity: 0.6,
  },
  farmMapPageBoldText: {
    color: "#000000",
    fontWeight: 500,
    opacity: 0.87,
  },
  farmMapPageDeforestationText: {
    fontWeight: 500,
  },
  blueLink: {
    color: "#0D6EFD",
    textDecoration: "underline",
  },
  farmMapPageMapImageContainer: {
    marginBottom: 30,
    width: "100%",
    maxHeight: "370px",
  },
  farmMapPageMapImage: {
    width: "100%", // Adjust as needed
    height: "95%", // Fills the container
    objectFit: "cover", // Ensures the image scales properly
  },
  appendixPage: {
    padding: "30px",
    fontSize: 12,
    color: "#3A3541",
  },
  appendixPageTitleContainer: {},
  appendixPageTitleText: {
    fontSize: 20,
    fontWeight: 500,
  },
  appendixPageBodyContainer: {
    paddingLeft: 20,
    paddingRight: 20,
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
  deforestationExplanationPageTableRow: {
    minHeight: 92,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
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
  deforestationExplanationPageTableLeftCellChip: {
    width: "100%",
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  appendixPageTableLeftCell: {
    backgroundColor: "#F9F9F9",
    padding: "8px",
    flex: 1,
    display: "flex",
    justifyContent: "center",
    fontWeight: 500,
  },
  deforestationExplanationPageTableLeftCell: {
    alignItems: "center",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  appendixPageTableRightCell: {
    padding: "8px 10px",
    flex: 2,
    display: "flex",
    justifyContent: "center",
    lineHeight: "18px",
  },
  mapsExplanationMapNameText: {
    fontSize: 18,
    fontWeight: 700,
    marginTop: 20,
    marginBottom: 16,
    marginLeft: 20,
  },
  mapsExplanationPageTableRightCell: {
    // lineHeight: undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  footer: {
    position: "absolute",
    bottom: 20, // Distance from the bottom edge
    left: 40,
    right: 30,
    textAlign: "right",
    fontSize: 12,
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
