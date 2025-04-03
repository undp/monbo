import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  coverPage: {
    fontFamily: "Roboto",
    fontSize: 16,
    fontWeight: 500,
    letterSpacing: 0.15,
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
  coverPageBackgroundONUImageContainer: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: "272px",
    height: "147px",
  },
  coverPageBackgroundONULogoImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
    objectFit: "fit",
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
    // ok
    fontFamily: "Roboto",
    fontSize: 12,
    padding: "30px",
    letterSpacing: 0.15,
  },
  farmMapPageSection: {
    // ok
    marginBottom: 12,
  },
  farmMapPageTable: {
    //ok
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
  farmMapPageGridItem: {
    width: "50%", // Adjust to fit the spacing
  },
  farmMapPageTitleText: {
    // ok
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
  farmMapPageBlueLink: {
    color: "#0D6EFD",
    textDecoration: "underline",
  },
  farmMapPageMapImageContainer: {
    marginBottom: 40,
    width: "100%",
    maxHeight: "380px",
  },
  farmMapPageMapImage: {
    width: "100%", // Adjust as needed
    height: "100%", // Fills the container
    objectFit: "cover", // Ensures the image scales properly
  },
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
