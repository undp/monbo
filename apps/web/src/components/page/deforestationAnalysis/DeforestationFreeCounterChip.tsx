import { Chip, Tooltip, SxProps, Theme } from "@mui/material";
import { formatNumber } from "@/utils/numbers";
import { useTranslation } from "react-i18next";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import { LayerCategoryIcon } from "@/components/reusable/LayerCategoryIcon";
import { localizedText } from "@/utils/localizedText";

interface DeforestationFreeCounterChipProps {
  /** How many farms are `ok` in the layer; null when none has a result. */
  count: number | null;
  /** The layer's category: its color, icon and `ok` label. */
  category: LayerCategory | null;
  sx?: SxProps<Theme>;
}

/** A layer's `ok` farms, in the color and with the icon of the layer's category. */
export const DeforestationFreeCounterChip: React.FC<
  DeforestationFreeCounterChipProps
> = ({ count, category, sx }) => {
  const { t, i18n } = useTranslation();
  if (count === null || !category)
    return (
      <Chip
        label={t("common:na")}
        sx={{
          backgroundColor: "#D5D5D5",
          color: "#676767",
          ...sx,
        }}
        size="small"
      />
    );
  return (
    <Tooltip
      title={localizedText(category.resultLabels.ok, i18n.language)}
      placement="right"
    >
      <Chip
        label={formatNumber(count, 0)}
        icon={
          <LayerCategoryIcon
            icon={category.icon}
            sx={{ fontSize: 14, "&&": { color: "white" } }}
          />
        }
        sx={{
          backgroundColor: category.color,
          color: "white",
          ...sx,
        }}
        size="small"
      />
    </Tooltip>
  );
};
