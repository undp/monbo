"use client";

import { Suspense } from "react";
import { Box } from "@mui/material";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import TableRowsOutlinedIcon from "@mui/icons-material/TableRowsOutlined";
import { useTranslation } from "react-i18next";
import { FlowSection } from "@/components/page/flow/FlowSection";
import { RESULTS_SECTION_HEIGHT } from "@/components/page/flow/flowLayoutSizes";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { FLOW_TABLE_FRAME, FLOW_TABLE_SX } from "@/components/page/flow/flowTable";
import { SearchBar } from "@/components/reusable/inputs/SearchBar";
import { SearchParamButton } from "@/components/reusable/SearchParamButton";
import { LayerResultsTable } from "./LayerResultsTable";
import { MapView } from "./MapView";
import { ResultsMapSelector } from "./ResultsMapSelector";

const VIEW_LINK_SX = {
  textTransform: "none",
  fontSize: 15,
  fontWeight: 500,
  color: FLOW_COLORS.blue,
  whiteSpace: "nowrap",
} as const;

/**
 * Stage 2's results by polygon and layer, as a table or on the map (`?view=`).
 * The section's header holds the search (or, on the map, the layer to show) and
 * the switch between both views.
 */
export const LayerResultsSection: React.FC<{ view: "table" | "map" }> = ({ view }) => {
  const { t } = useTranslation();
  const onMap = view === "map";

  const actions = (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 1.5,
      }}
    >
      {onMap ? (
        <ResultsMapSelector />
      ) : (
        <Suspense>
          <SearchBar
            placeholder={t("territorialAnalysis:searchPlaceholder")}
            style={{ minWidth: { xs: "100%", sm: 280 } }}
          />
        </Suspense>
      )}
      <SearchParamButton
        searchParamKey="view"
        searchParamValue={onMap ? "table" : "map"}
        startIcon={onMap ? <TableRowsOutlinedIcon /> : <MapOutlinedIcon />}
        sx={VIEW_LINK_SX}
      >
        {t(onMap ? "territorialAnalysis:results.seeTable" : "territorialAnalysis:results.seeOnMap")}
      </SearchParamButton>
    </Box>
  );

  return (
    <FlowSection
      title={t("territorialAnalysis:results.byPolygonTitle")}
      subtitle={t("territorialAnalysis:results.byPolygonSubtitle")}
      icon={<GridViewOutlinedIcon />}
      action={actions}
      // The table: as tall as its rows, up to the viewport, from where it scrolls
      sx={
        onMap ? undefined : { maxHeight: RESULTS_SECTION_HEIGHT, display: "flex", flexDirection: "column" }
      }
    >
      {onMap ? (
        <Box
          sx={{
            ...FLOW_TABLE_FRAME,
            overflow: "hidden",
            // On a phone the list goes above the map, each with its own height
            height: { xs: "auto", md: RESULTS_SECTION_HEIGHT },
          }}
        >
          <MapView />
        </Box>
      ) : (
        <Box
          data-testid="results-frame"
          sx={{
            ...FLOW_TABLE_FRAME,
            ...FLOW_TABLE_SX,
            flex: "0 1 auto",
            minHeight: 0,
            // The frame is the only scroller, so the sticky header sticks to it:
            // the table's own container would otherwise grow with its rows and
            // scroll the header away
            "& .MuiTableContainer-root": {
              overflowX: "visible",
              overflowY: "visible",
              height: "auto",
            },
            // The category row: its labels on the band, with no line under them
            "& thead tr:first-of-type th": { paddingBottom: 0.5 },
          }}
        >
          <LayerResultsTable farmColumns="compact" />
        </Box>
      )}
    </FlowSection>
  );
};
