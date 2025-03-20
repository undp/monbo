import { Chip, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";

export const ValidManuallyChip: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Tooltip title={t("common:validatedManually")}>
      <Chip
        label="VM"
        size="small"
        sx={{
          backgroundColor: "#ED6C02",
          color: "#fff",
        }}
      />
    </Tooltip>
  );
};
