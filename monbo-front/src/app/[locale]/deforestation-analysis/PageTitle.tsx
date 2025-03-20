"use client";

import { DataContext } from "@/context/DataContext";
import { useContext, useMemo, useState } from "react";
import { Text } from "@/components/reusable/Text";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/utils/numbers";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import { Box, IconButton } from "@mui/material";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { MapsDetailsModal } from "./MapsDetailsModal";
export const PageTitle: React.FC = () => {
  const {
    farmsData,
    polygonsValidationResults,
    deforestationAnalysisParams: { polygonsSubset },
  } = useContext(DataContext);
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);

  const farmsAmount = useMemo(() => {
    if (!farmsData) return 0;

    if (!polygonsSubset || polygonsSubset === "all") {
      return farmsData.length;
    }

    if (polygonsSubset === "valid") {
      // Count the farms that were valid at the polygons validation stage
      return farmsData.filter(
        (f) =>
          polygonsValidationResults?.farmResults.find(
            ({ farmId }) => farmId === f.id
          )?.status !== FarmValidationStatus.NOT_VALID
      ).length;
    }
    return 0;
  }, [farmsData, polygonsValidationResults, polygonsSubset]);

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Text variant="h3" bold>
          {t("deforestationAnalysis:title")} ({formatNumber(farmsAmount)})
        </Text>
        <IconButton onClick={() => setOpen(true)}>
          <InfoOutlined />
        </IconButton>
      </Box>
      <MapsDetailsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};
