"use client";
import { createTheme } from "@mui/material/styles";

// The start page's palette (mockup v2): navy and forest greens.
interface LandingPalette {
  navy: string;
  navyForest: string;
  forest: string;
  leaf: string;
  leafLight: string;
  onLeafLight: string;
  eyebrow: string;
  mint: string;
  mintStrong: string;
  ink: string;
  inkSecondary: string;
  muted: string;
  line: string;
  blue: string;
  blueDark: string;
  blueTint: string;
  background: string;
  silhouette: string;
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
      navy: "#0a2440",
      // The hero gradient's middle stop, between navy and forest
      navyForest: "#0c2f3b",
      forest: "#0e3b30",
      leaf: "#2f8f5e",
      leafLight: "#5cc08a",
      // Text on leafLight, and the hero's eyebrow over the dark gradient
      onLeafLight: "#06301f",
      eyebrow: "#9fd8b6",
      mint: "#eef7f1",
      mintStrong: "#d6ecdf",
      ink: "#0b2545",
      inkSecondary: "#3d5873",
      muted: "#6b8299",
      line: "#e2ecf5",
      blue: "#0d64a0",
      blueDark: "#0a4f7e",
      blueTint: "#e8f1fa",
      background: "#f6faf8",
      // Country silhouettes in the start bar, before they are chosen
      silhouette: "#8aa3bb",
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
