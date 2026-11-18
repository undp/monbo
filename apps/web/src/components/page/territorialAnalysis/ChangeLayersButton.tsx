"use client";

import { Button } from "@mui/material";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import { useContext } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { localizedPath } from "@/utils/languageChange";

/**
 * Back to the stage 2 selection page, starting from the subset and layers of the
 * results on screen (an unanalysed draft is dropped). That page starts nothing
 * until "Analizar" is pressed, and the results don't change until it succeeds.
 */
export const ChangeLayersButton: React.FC = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { setAnalysisDraft } = useContext(DataContext);

  return (
    <Button
      variant="outlined"
      startIcon={<LayersOutlinedIcon />}
      onClick={() => {
        setAnalysisDraft(null);
        router.push(
          localizedPath("/territorial-analysis/upload-data", i18n.language)
        );
      }}
      sx={{ whiteSpace: "nowrap" }}
    >
      {t("territorialAnalysis:results.changeLayers")}
    </Button>
  );
};
