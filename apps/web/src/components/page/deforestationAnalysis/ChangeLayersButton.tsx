"use client";

import { Button } from "@mui/material";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

/**
 * Back to the stage 2 selection page, with the farms, the subset and the layers kept.
 * That page starts nothing until "Analizar" is pressed.
 */
export const ChangeLayersButton: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Button
      variant="outlined"
      startIcon={<LayersOutlinedIcon />}
      onClick={() => router.push("/deforestation-analysis/upload-data")}
      sx={{ whiteSpace: "nowrap" }}
    >
      {t("deforestationAnalysis:results.changeLayers")}
    </Button>
  );
};
