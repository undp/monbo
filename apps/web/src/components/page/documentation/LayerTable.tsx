import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { MapData } from "@/interfaces/DeforestationAnalysis";
import { layerPeriod } from "@/utils/layerCatalog";
import { TABLE_HEADER_BACKGROUND } from "./methodologyStyles";

const MISSING = "—";

const COLUMNS = ["name", "coverage", "source", "period", "resolution", "updateFrequency"] as const;

/**
 * A category's layers: a table from 900 px; below, the same rows as cards, each
 * cell with its column's name (one DOM for both, so nothing is read twice).
 */
export const LayerTable: React.FC<{ layers: MapData[] }> = ({ layers }) => {
  const { t } = useTranslation();
  const colors = useTheme().palette.landing;
  const values = (map: MapData): Record<(typeof COLUMNS)[number], string | null> => ({
    name: map.name ?? null,
    coverage: map.coverage ?? null,
    source: map.source ?? null,
    period: layerPeriod(map),
    resolution: map.resolution ?? null,
    updateFrequency: map.updateFrequency ?? null,
  });

  return (
    <Box
      sx={{
        mt: 1.5,
        border: { md: `1px solid ${colors.line}` },
        borderRadius: "12px",
        overflowX: { md: "auto" },
      }}
    >
      <Box
        component="table"
        sx={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
          color: colors.ink,
          "& th": {
            textAlign: "left",
            font: "700 11px/1.2 var(--font-roboto), sans-serif",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: colors.muted,
            px: 1.5,
            py: 1.25,
            backgroundColor: TABLE_HEADER_BACKGROUND,
            borderBottom: `1px solid ${colors.line}`,
          },
          "& td": {
            px: 1.5,
            py: 1.25,
            verticalAlign: "top",
            borderBottom: `1px solid ${colors.line}`,
            overflowWrap: "anywhere",
          },
          "& tbody tr:last-of-type td": { borderBottom: 0 },
          // Phones: each row is a card, each cell "Column: value".
          "@media (max-width: 899.95px)": {
            "& thead": { display: "none" },
            "& tbody, & tr, & td": { display: "block" },
            "& tr": {
              border: `1px solid ${colors.line}`,
              borderRadius: "12px",
              mb: 1.5,
              py: 0.5,
            },
            "& td, & tbody tr:last-of-type td": {
              display: "grid",
              gridTemplateColumns: "minmax(96px, 35%) 1fr",
              gap: 1.5,
              borderBottom: 0,
              py: 0.75,
            },
            "& td::before": {
              content: "attr(data-label)",
              font: "700 11px/1.6 var(--font-roboto), sans-serif",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: colors.muted,
            },
          },
        }}
      >
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col">
                {t(`methodology:layer:${column}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {layers.map((map) => {
            const row = values(map);
            return (
              <tr key={map.id}>
                {COLUMNS.map((column) => (
                  <td key={column} data-label={t(`methodology:layer:${column}`)}>
                    {column === "name" ? (
                      <Box>
                        <Box component="b" sx={{ fontWeight: 600 }}>
                          {row.name ?? MISSING}
                        </Box>
                        {map.alias && (
                          <Box sx={{ color: colors.muted, fontSize: 12.5 }}>{map.alias}</Box>
                        )}
                      </Box>
                    ) : (
                      (row[column] ?? MISSING)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </Box>
    </Box>
  );
};
