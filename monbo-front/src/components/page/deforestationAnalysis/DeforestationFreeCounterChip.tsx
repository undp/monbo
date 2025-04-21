import { Chip, Tooltip, SxProps, Theme } from "@mui/material";
import { OutlinedMomboIcon } from "@/components/icons/MomboIcon";
import { formatNumber } from "@/utils/numbers";
import { useTranslation } from "react-i18next";

interface DeforestationFreeCounterChipProps {
  count: number | null;
  sx?: SxProps<Theme>;
}

export const DeforestationFreeCounterChip: React.FC<
  DeforestationFreeCounterChipProps
> = ({ count, sx }) => {
  const { t } = useTranslation();
  if (count === null)
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
      title={t("deforestationAnalysis:deforestationFreeShortText")}
      placement="right"
    >
      <Chip
        label={formatNumber(count, 0)}
        icon={<OutlinedMomboIcon sx={{ fontSize: 12 }} />}
        sx={{
          backgroundColor: "#2E7D32",
          color: "white",
          ...sx,
        }}
        size="small"
      />
    </Tooltip>
  );
};
