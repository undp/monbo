import { SxProps, Theme } from "@mui/material";

// The raster upload's buttons: sentence case and roomier than the app's default.
export const rasterButtonSx: SxProps<Theme> = {
  textTransform: "none",
  borderRadius: "10px",
  padding: "10px 22px",
  fontSize: 15,
  fontWeight: 500,
  boxShadow: "none",
};
