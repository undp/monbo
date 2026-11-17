import { Box, Typography, useTheme } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { useTranslation } from "react-i18next";
import { CategoryIcon } from "@/components/reusable/CategoryIcon";
import type { MapData } from "@/interfaces/DeforestationAnalysis";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import { localizedText } from "@/utils/layerCatalog";
import { formatThreshold } from "@/utils/numbers";
import { LayerTable } from "./LayerTable";
import { HEADING_FONT, categoryTint } from "./methodologyStyles";
import { ResultChip } from "./ResultChip";

/** One category of the country: what it marks, its threshold and results, and its layers. */
export const CategoryBlock: React.FC<{ category: LayerCategory | null; layers: MapData[] }> = ({
  category,
  layers,
}) => {
  const { t, i18n } = useTranslation();
  const colors = useTheme().palette.landing;
  const language = i18n.language;
  const color = category?.color ?? colors.muted;
  const threshold = category ? formatThreshold(category.thresholdPercentage, language) : "";
  const name = category ? localizedText(category.name, language) : t("methodology:category:others");

  return (
    <Box
      component="section"
      aria-label={name}
      sx={{
        border: `1px solid ${colors.line}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: "14px",
        backgroundColor: "common.white",
        p: { xs: 2, md: "16px 18px" },
        mb: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            flex: "none",
            borderRadius: "10px",
            display: "grid",
            placeItems: "center",
            color,
            backgroundColor: categoryTint(color),
          }}
        >
          <CategoryIcon icon={category?.icon ?? "layers"} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h3" sx={{ font: `700 16px/1.2 ${HEADING_FONT}`, color: colors.ink }}>
            {name}
          </Typography>
          <Typography sx={{ color: colors.muted, fontSize: 13, mt: 0.25 }}>
            {category
              ? localizedText(category.description, language)
              : t("methodology:category:othersDescription")}
          </Typography>
        </Box>
      </Box>

      {category && (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={{ fontSize: 14, color: colors.inkSecondary }}>
            {t(`methodology:category:${category.polarity}`)}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
            <ResultChip kind="neutral">{t("methodology:category:threshold", { threshold })}</ResultChip>
            <ResultChip kind="ok">
              <CheckIcon aria-hidden sx={{ fontSize: 14 }} />
              {localizedText(category.resultLabels.ok, language)} ·{" "}
              {t(`methodology:category:rules:${category.polarity}:ok`, { threshold })}
            </ResultChip>
            <ResultChip kind="flagged">
              {localizedText(category.resultLabels.flagged, language)} ·{" "}
              {t(`methodology:category:rules:${category.polarity}:flagged`, { threshold })}
            </ResultChip>
          </Box>
        </Box>
      )}

      {layers.length === 0 ? (
        <Typography sx={{ mt: 1.5, fontSize: 14, color: colors.muted }}>
          {t("methodology:category:noLayers")}
        </Typography>
      ) : (
        <LayerTable layers={layers} />
      )}
    </Box>
  );
};
