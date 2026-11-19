"use client";

import { Box, ButtonBase, Link } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useTranslation } from "react-i18next";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import type { AnalysisDraft } from "@/context/DataContext";
import { AS_TEXT } from "@/utils/asText";

type PolygonsSubset = AnalysisDraft["polygonsSubset"];

const ARROWS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

/** IDs named before "y N más". */
const NAMED_IDS = 3;

interface Props {
  /** How many polygons the analysis will use. */
  count: number;
  /** With a validation: the subset choice and the polygons it leaves out. */
  validation: {
    subset: PolygonsSubset;
    onSubsetChange: (subset: PolygonsSubset) => void;
    validCount: number;
    allCount: number;
    /** The IDs of the polygons that didn't pass the validation. */
    notValidIds: string[];
  } | null;
  onSeePolygons: () => void;
}

/**
 * Above the layers: which polygons the analysis will use. After a validation the
 * user chooses between the valid ones and all of them, and is told which ones the
 * valid subset leaves out; without one, it only says they weren't validated.
 */
export const SubsetBanner: React.FC<Props> = ({ count, validation, onSeePolygons }) => {
  const { t } = useTranslation();
  const leftOut =
    validation?.subset === "valid" && validation.notValidIds.length > 0
      ? validation.notValidIds
      : [];
  const named = leftOut.slice(0, NAMED_IDS).join(", ");
  const ids =
    leftOut.length > NAMED_IDS
      ? t("territorialAnalysis:uploadDataPage:subset.idsAndMore", {
          ids: named,
          count: leftOut.length - NAMED_IDS,
          ...AS_TEXT,
        })
      : named;

  return (
    <Box
      role="region"
      aria-label={t("territorialAnalysis:uploadDataPage:subset.label")}
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: 1.5,
        rowGap: 1,
        padding: "12px 16px",
        borderRadius: "12px",
        border: `1px solid ${FLOW_COLORS.line}`,
        backgroundColor: FLOW_COLORS.blue50,
        color: FLOW_COLORS.ink,
        fontSize: 14.5,
      }}
    >
      <InfoOutlinedIcon fontSize="small" sx={{ color: FLOW_COLORS.blue }} aria-hidden />
      <Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
        <Box component="span">
          {validation
            ? t("territorialAnalysis:uploadDataPage:subset.message", { count })
            : t("territorialAnalysis:uploadDataPage:subset.unvalidated", { count })}
        </Box>
        {leftOut.length > 0 && (
          <Box component="span">
            {" "}
            {t("territorialAnalysis:uploadDataPage:subset.leftOut", {
              ids,
              count: leftOut.length,
              ...AS_TEXT,
            })}
          </Box>
        )}
      </Box>
      {validation && (
        <Box
          role="radiogroup"
          aria-label={t("territorialAnalysis:uploadDataPage:subset.label")}
          // A radio group: the arrows move the choice, Tab leaves the group
          onKeyDown={(event) => {
            if (!ARROWS.includes(event.key)) return;
            event.preventDefault();
            const next = validation.subset === "valid" ? "all" : "valid";
            validation.onSubsetChange(next);
            event.currentTarget
              .querySelector<HTMLElement>(`[data-subset="${next}"]`)
              ?.focus();
          }}
          sx={{
            display: "inline-flex",
            padding: "3px",
            borderRadius: "10px",
            backgroundColor: FLOW_COLORS.white,
            border: `1px solid ${FLOW_COLORS.line}`,
          }}
        >
          <SubsetOption
            value="valid"
            checked={validation.subset === "valid"}
            onSelect={() => validation.onSubsetChange("valid")}
            label={t("territorialAnalysis:uploadDataPage:subset.valid", {
              count: validation.validCount,
            })}
          />
          <SubsetOption
            value="all"
            checked={validation.subset === "all"}
            onSelect={() => validation.onSubsetChange("all")}
            label={t("territorialAnalysis:uploadDataPage:subset.all", {
              count: validation.allCount,
            })}
          />
        </Box>
      )}
      <Link
        component="button"
        type="button"
        underline="hover"
        onClick={onSeePolygons}
        sx={{ fontSize: 14.5, fontWeight: 500, color: FLOW_COLORS.blue }}
      >
        {t("territorialAnalysis:uploadDataPage:subset.seePolygons")}
      </Link>
    </Box>
  );
};

/** One side of the segmented subset choice. */
const SubsetOption: React.FC<{
  value: PolygonsSubset;
  checked: boolean;
  onSelect: () => void;
  label: string;
}> = ({ value, checked, onSelect, label }) => (
  <ButtonBase
    role="radio"
    aria-checked={checked}
    data-subset={value}
    tabIndex={checked ? 0 : -1}
    onClick={onSelect}
    sx={{
      paddingX: 1.5,
      paddingY: 0.5,
      borderRadius: "8px",
      fontFamily: "inherit",
      fontSize: 13.5,
      fontWeight: checked ? 600 : 500,
      color: checked ? FLOW_COLORS.white : FLOW_COLORS.ink2,
      backgroundColor: checked ? FLOW_COLORS.blue : "transparent",
      transition: "background-color 120ms, color 120ms",
      "&.Mui-focusVisible": {
        outline: `2px solid ${FLOW_COLORS.blue}`,
        outlineOffset: 2,
      },
    }}
  >
    {label}
  </ButtonBase>
);
