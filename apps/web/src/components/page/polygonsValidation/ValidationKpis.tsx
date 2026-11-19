"use client";

import { useContext, useMemo } from "react";
import { Box, ButtonBase } from "@mui/material";
import { useTranslation } from "react-i18next";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { DataContext } from "@/context/DataContext";
import { useResultsFilter } from "@/hooks/useResultsFilter";
import { FLOW_COLORS, HEADING_FONT } from "@/components/page/flow/flowStyles";
import {
  ResultsFilter,
  farmValidationViews,
  matchesResultsFilter,
} from "@/utils/validationResults";

/**
 * The validation in three numbers: the polygons ready to analyze (valid or
 * validated manually), and the ones still not valid because they overlap or
 * because their geometry is wrong. A polygon with both counts in both. Each card
 * filters the table to its polygons; pressing it again shows them all.
 */
export const ValidationKpis: React.FC = () => {
  const { t } = useTranslation();
  const { farmsData, polygonsValidationResults } = useContext(DataContext);
  const [filter, setFilter] = useResultsFilter();

  const counts = useMemo(() => {
    const views =
      farmsData && polygonsValidationResults
        ? farmValidationViews(farmsData, polygonsValidationResults)
        : [];
    const count = (kind: ResultsFilter) =>
      views.filter((view) => matchesResultsFilter(view, kind)).length;
    return { ready: count("ready"), overlap: count("overlap"), error: count("error") };
  }, [farmsData, polygonsValidationResults]);

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
        count={counts.ready}
        label={t("polygonValidation:kpis:ready")}
        active={filter === "ready"}
        onClick={() => setFilter("ready")}
      />
      <Kpi
        tone="warn"
        icon={<WarningAmberRoundedIcon fontSize="small" />}
        count={counts.overlap}
        label={t("polygonValidation:kpis:overlap")}
        active={filter === "overlap"}
        onClick={() => setFilter("overlap")}
      />
      <Kpi
        tone="bad"
        icon={<CloseRoundedIcon fontSize="small" />}
        count={counts.error}
        label={t("polygonValidation:kpis:error")}
        active={filter === "error"}
        onClick={() => setFilter("error")}
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
  /** Whether the table shows only this card's polygons. */
  active: boolean;
  onClick: () => void;
}> = ({ tone, icon, count, label, active, onClick }) => {
  const { color, background } = TONES[tone];
  return (
    <ButtonBase
      aria-pressed={active}
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 1.5,
        padding: "14px 16px",
        borderRadius: "12px",
        textAlign: "left",
        fontFamily: "inherit",
        // The same box when active: the border's color changes, not its width
        border: `1px solid ${active ? color : FLOW_COLORS.line}`,
        boxShadow: active ? `inset 0 0 0 1px ${color}` : "none",
        backgroundColor: FLOW_COLORS.white,
        transition: "border-color 120ms, box-shadow 120ms",
        "&:hover": { borderColor: color },
        "&.Mui-focusVisible": {
          outline: `2px solid ${FLOW_COLORS.blue}`,
          outlineOffset: 2,
        },
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
          color,
          backgroundColor: background,
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
        <Box component="span" sx={{ display: "block", fontSize: 13, color: FLOW_COLORS.ink2 }}>
          {label}
        </Box>
      </Box>
    </ButtonBase>
  );
};
