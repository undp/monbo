"use client";
import { createTheme } from "@mui/material/styles";

// The country selection landing page has its own green palette.
interface LandingPalette {
  primary: string;
  primaryDark: string;
  tint: string;
  tintHover: string;
  shape: string;
  shapeSelected: string;
  ring: string;
  text: string;
  textSecondary: string;
}

declare module "@mui/material/styles" {
  interface Palette {
    landing: LandingPalette;
  }
  interface PaletteOptions {
    landing?: LandingPalette;
  }
}

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
    landing: {
      primary: "#1f7a3a",
      primaryDark: "#17602d",
      // Country cards: background, background on hover, silhouette and radio ring
      tint: "#e8f0e8",
      tintHover: "#dde8dd",
      shape: "#c6dcc6",
      shapeSelected: "#2f8a4a",
      ring: "#a9bfaa",
      text: "#2f2c3d",
      textSecondary: "#4a4759",
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
