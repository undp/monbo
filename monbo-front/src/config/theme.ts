"use client";
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#03689E",
    },
    background: {
      default: "#F9F9F9",
    },
    text: {
      primary: "#3A3541",
      secondary: "#667085",
    },
  },
  typography: {
    fontFamily: "var(--font-roboto)",
    h3: {
      fontSize: 20,
      lineHeight: "27px",
    },
    h4: {
      fontSize: 16,
      lineHeight: "23px",
    },
  },
});

export const baseMapColor = "#FFFF33";
export const issueMapColor = "#E2231A";
export const multipleObjectsMapColors = [
  baseMapColor,
  "#FF33CC",
  "#00FFFF",
  "#FF9900",
  "#0084FF",
  "#33FF57",
  "#E6E6E6",
  "#CC33FF",
  "#1CC83A",
];

export default theme;
