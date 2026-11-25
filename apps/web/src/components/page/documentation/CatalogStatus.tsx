import { Box, Button, CircularProgress, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { CountryLayerCatalogState } from "@/hooks/useCountryLayerCatalog";

interface CatalogStatusProps {
  state: CountryLayerCatalogState;
  countryName: string;
}

/**
 * What the layers and limits sections show while a country's catalog isn't ready:
 * a loading line, or the error with a retry. Nothing once it is ready.
 */
export const CatalogStatus: React.FC<CatalogStatusProps> = ({ state, countryName }) => {
  const { t } = useTranslation();
  const colors = useTheme().palette.landing;

  if (state.status === "loading") {
    return (
      <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1.5, color: colors.muted, py: 2 }}>
        <CircularProgress size={18} aria-hidden />
        {t("methodology:catalog:loading", { country: countryName })}
      </Box>
    );
  }
  if (state.status === "error") {
    return (
      <Box
        role="alert"
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 2,
          p: 2,
          border: `1px solid ${colors.line}`,
          borderRadius: 2,
          backgroundColor: "common.white",
        }}
      >
        <Typography sx={{ flex: 1, minWidth: 200 }}>
          {t("methodology:catalog:error", { country: countryName })}
        </Typography>
        <Button variant="outlined" onClick={state.retry}>
          {t("methodology:catalog:retry")}
        </Button>
      </Box>
    );
  }
  return null;
};
