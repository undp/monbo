import { createTheme } from "@mui/material/styles";
import theme from "@/config/theme";

export const SENTINEL = "#123456";
export const SENTINEL_RGB = "rgb(18, 52, 86)";

/** The app theme with one result color replaced, to prove a component reads the theme. */
export const themeWithResultColor = (key: string, value: string = SENTINEL) =>
  createTheme(theme, { palette: { result: { [key]: value } } } as never);
