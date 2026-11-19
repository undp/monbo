"use client";

import { useContext, useMemo } from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { DataContext } from "@/context/DataContext";
import { useValidFarmsDataForValidationPage } from "@/hooks/useValidFarmsDataForValidationPage";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import { FLOW_COLORS, HEADING_FONT } from "@/components/page/flow/flowStyles";

/**
 * The validation in three numbers: the polygons ready to analyze (valid or
 * validated manually), and the ones still not valid because they overlap or
 * because their geometry is wrong. A polygon with both counts in both.
 */
export const ValidationKpis: React.FC = () => {
  const { t } = useTranslation();
  const { polygonsValidationResults } = useContext(DataContext);
  const { farmsData: validFarms } = useValidFarmsDataForValidationPage();

  const { overlapping, withErrors } = useMemo(() => {
    const notValid = new Set(
      polygonsValidationResults?.farmResults
        .filter(({ status }) => status === FarmValidationStatus.NOT_VALID)
        .map(({ farmId }) => farmId) ?? []
    );
    const overlapping = new Set<string>();
    const withErrors = new Set<string>();
    polygonsValidationResults?.inconsistencies.forEach((inconsistency) =>
      inconsistency.farmIds
        .filter((farmId) => notValid.has(farmId))
        .forEach((farmId) =>
          (inconsistency.type === "overlap" ? overlapping : withErrors).add(farmId)
        )
    );
    return { overlapping: overlapping.size, withErrors: withErrors.size };
  }, [polygonsValidationResults]);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
        gap: 1.5,
      }}
    >
      <Kpi
        tone="ok"
        icon={<CheckRoundedIcon fontSize="small" />}
        count={validFarms.length}
        label={t("polygonValidation:kpis:ready")}
      />
      <Kpi
        tone="warn"
        icon={<WarningAmberRoundedIcon fontSize="small" />}
        count={overlapping}
        label={t("polygonValidation:kpis:overlap")}
      />
      <Kpi
        tone="bad"
        icon={<CloseRoundedIcon fontSize="small" />}
        count={withErrors}
        label={t("polygonValidation:kpis:error")}
      />
    </Box>
  );
};

const TONES = {
  ok: { color: FLOW_COLORS.ok, background: FLOW_COLORS.okBackground },
  warn: { color: FLOW_COLORS.warn, background: FLOW_COLORS.warnBackground },
  bad: { color: FLOW_COLORS.bad, background: FLOW_COLORS.badBackground },
};

const Kpi: React.FC<{
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  count: number;
  label: string;
}> = ({ tone, icon, count, label }) => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1.5,
      padding: "14px 16px",
      borderRadius: "12px",
      border: `1px solid ${FLOW_COLORS.line}`,
      backgroundColor: FLOW_COLORS.white,
    }}
  >
    <Box
      aria-hidden
      sx={{
        width: 36,
        height: 36,
        flex: "none",
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        color: TONES[tone].color,
        backgroundColor: TONES[tone].background,
      }}
    >
      {icon}
    </Box>
    <Box>
      <Box
        component="span"
        sx={{
          display: "block",
          fontFamily: HEADING_FONT,
          fontSize: 26,
          fontWeight: 800,
          lineHeight: 1,
          color: FLOW_COLORS.ink,
        }}
      >
        {count}
      </Box>
      <Box component="small" sx={{ display: "block", fontSize: 13, color: FLOW_COLORS.ink2 }}>
        {label}
      </Box>
    </Box>
  </Box>
);
