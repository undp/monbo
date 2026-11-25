"use client";
import { createTheme } from "@mui/material/styles";

interface CategoryColors {
  main: string;
  tint: string;
}

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
  /** A field's or a framed button's border: 1.74:1 on white, as MUI's default. */
  fieldLine: string;
  blue: string;
  blueDark: string;
  blueTint: string;
  background: string;
  silhouette: string;
  // The generic layer categories shown on the start page's step 2
  categories: {
    deforestation: CategoryColors;
    protectedAreas: CategoryColors;
    agriculturalFrontier: CategoryColors;
  };
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
      fieldLine: "#b6c6d6",
      blue: "#0d64a0",
      blueDark: "#0a4f7e",
      blueTint: "#e8f1fa",
      background: "#f6faf8",
      // Country silhouettes in the start bar, before they are chosen
      silhouette: "#8aa3bb",
      categories: {
        deforestation: { main: "#2f8f5e", tint: "#e5f3ea" },
        protectedAreas: { main: "#0f7c86", tint: "#e0f2f3" },
        agriculturalFrontier: { main: "#a8741a", tint: "#f8eedb" },
      },
    },
  },
  components: {
    // The v2 look (mockup) for every button: sentence case, round corners, no
    // shadow, and the flow's blue for the primary ones. A screen that styles a
    // button with `sx` still overrides this.
    MuiButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          textTransform: "none",
          borderRadius: 10,
          fontWeight: 600,
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
          variants: [
            {
              props: { variant: "contained", color: "primary" },
              style: {
                backgroundColor: theme.palette.landing.blue,
                "&:hover": { backgroundColor: theme.palette.landing.blueDark },
              },
            },
            {
              props: { variant: "outlined", color: "primary" },
              style: {
                color: theme.palette.landing.blue,
                borderColor: theme.palette.landing.fieldLine,
                backgroundColor: theme.palette.common.white,
                "&:hover": {
                  borderColor: theme.palette.landing.blue,
                  backgroundColor: theme.palette.landing.blueTint,
                },
              },
            },
            {
              props: { variant: "text", color: "primary" },
              style: { color: theme.palette.landing.blue },
            },
          ],
        }),
      },
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
