"use client";

import { useMemo } from "react";
import { Box, Checkbox } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { MapData } from "@/interfaces/LayerAnalysis";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import { groupLayersByCategory } from "@/utils/layerResults";
import { layerLabel } from "@/utils/layerLabel";
import { localizedText } from "@/utils/localizedText";
import { categoryTints } from "@/utils/categoryColors";
import { LayerCategoryIcon } from "@/components/reusable/LayerCategoryIcon";
import { HEADING_FONT } from "@/components/page/flow/flowStyles";

interface Props {
  /** The country's layers. */
  layers: MapData[];
  /** The country's categories, in the order to show them. */
  categories: LayerCategory[];
  selectedIds: Set<number>;
  onChange: (layer: MapData, checked: boolean) => void;
}

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    component="span"
    sx={{
      fontSize: 10,
      fontWeight: 700,
      lineHeight: 1,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      padding: "3px 6px",
      borderRadius: 1,
      backgroundColor: "#EEF2F6",
      color: "text.secondary",
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </Box>
);

/**
 * The country's layers grouped by category: a card per category (icon, color,
 * name, description, how many of its layers are ticked) with a checkbox per layer.
 * Layers whose category isn't listed are not offered: they have no rule.
 */
export const LayerCategoryPicker: React.FC<Props> = ({
  layers,
  categories,
  selectedIds,
  onChange,
}) => {
  const { t, i18n } = useTranslation();
  const groups = useMemo(
    () =>
      groupLayersByCategory(layers, categories).filter(
        (group): group is { category: LayerCategory; layers: MapData[] } =>
          group.category !== null
      ),
    [layers, categories]
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {groups.map(({ category, layers }) => {
        const tints = categoryTints(category.color);
        const name = localizedText(category.name, i18n.language);
        const ticked = layers.filter(({ id }) => selectedIds.has(id)).length;
        return (
          <Box
            key={category.id}
            role="group"
            aria-label={name}
            sx={{
              border: "1px solid #DEDEDE",
              borderRadius: 3.5,
              padding: { xs: 1.5, sm: "16px 18px" },
              backgroundColor: "#FFFFFF",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                aria-hidden
                sx={{
                  width: 38,
                  height: 38,
                  flex: "none",
                  borderRadius: 2.5,
                  display: "grid",
                  placeItems: "center",
                  backgroundColor: tints.background,
                  color: tints.color,
                }}
              >
                <LayerCategoryIcon icon={category.icon} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Box
                  component="span"
                  sx={{
                    display: "block",
                    fontFamily: HEADING_FONT,
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  {name}
                </Box>
                <Box
                  component="span"
                  sx={{ display: "block", fontSize: 13, color: "text.secondary" }}
                >
                  {localizedText(category.description, i18n.language)}
                </Box>
              </Box>
              <Box
                component="span"
                sx={{
                  marginLeft: "auto",
                  flex: "none",
                  fontSize: 13,
                  color: "text.secondary",
                }}
              >
                {t("territorialAnalysis:layerPicker.tickedOfTotal", {
                  ticked,
                  count: layers.length,
                })}
              </Box>
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  sm: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(3, minmax(0, 1fr))",
                },
                gap: 1.25,
                marginTop: 1.5,
              }}
            >
              {layers.map((layer) => {
                const checked = selectedIds.has(layer.id);
                const period =
                  layer.baseline !== null && layer.comparedAgainst !== null
                    ? `${layer.baseline} → ${layer.comparedAgainst}`
                    : null;
                const name = layer.name?.trim() || layerLabel(layer);
                const alias = layer.alias?.trim();
                return (
                  <Box
                    key={layer.id}
                    component="label"
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 0.5,
                      minWidth: 0,
                      padding: "8px 12px 10px 4px",
                      borderRadius: 2.5,
                      border: "1.5px solid",
                      borderColor: checked ? tints.color : "#DEDEDE",
                      backgroundColor: checked ? tints.faintBackground : "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    <Checkbox
                      checked={checked}
                      onChange={(event) => onChange(layer, event.target.checked)}
                      size="small"
                      sx={{
                        paddingY: 0.25,
                        "&.Mui-checked": { color: tints.color },
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Box
                        component="span"
                        sx={{ display: "block", fontSize: 14, fontWeight: 500 }}
                      >
                        {name}
                      </Box>
                      {alias && alias !== name && (
                        <Box
                          component="span"
                          sx={{
                            display: "block",
                            fontSize: 12.5,
                            color: "text.secondary",
                            marginTop: 0.25,
                          }}
                        >
                          {alias}
                        </Box>
                      )}
                      {(period || layer.resolution) && (
                        <Box
                          component="span"
                          sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 0.75,
                            marginTop: 0.75,
                          }}
                        >
                          {period && <Tag>{period}</Tag>}
                          {layer.resolution && <Tag>{layer.resolution}</Tag>}
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};
