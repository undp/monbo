"use client";

import React from "react";
import { Box, Button, Chip, FormControlLabel, FormHelperText, Switch } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { useTranslation } from "react-i18next";
import { LayerCategoryIcon } from "@/components/reusable/LayerCategoryIcon";
import { ResultChip } from "@/components/reusable/ResultChip";
import { FLOW_COLORS, HEADING_FONT, STAGE_CARD } from "@/components/page/flow/flowStyles";
import { AdminCategory, AdminLayer } from "@/interfaces/AdminLayer";
import { AS_TEXT } from "@/utils/asText";
import { categoryTints } from "@/utils/categoryColors";
import { localizedText } from "@/utils/localizedText";
import { formatThreshold } from "@/utils/numbers";
import { adminLanguage, adminLayerText } from "./adminLayerText";
import { CategoryLocks, describeLock } from "./categoryRules";

interface Props {
  category: AdminCategory;
  /** The country's layers in this category. */
  layers: AdminLayer[];
  locks: CategoryLocks;
  globalThreshold: number;
  /** Whether the categories can be written (the file is readable). */
  editable: boolean;
  updating: boolean;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
}

/**
 * One category of the country, as the mockup's admin cards show it: what it is on
 * the left, its result texts on the right, and its layers, switch and "Edit" below.
 */
export const CategoryCard: React.FC<Props> = ({
  category,
  layers,
  locks,
  globalThreshold,
  editable,
  updating,
  onToggle,
  onEdit,
}) => {
  const { t, i18n } = useTranslation();
  const language = adminLanguage(i18n.language);
  const otherLanguage = language === "es" ? "en" : "es";
  const tints = categoryTints(category.color);
  const name = localizedText(category.name, language);
  const description = localizedText(category.description, language);
  const threshold =
    category.thresholdPercentage === null
      ? t("admin:categories:card:globalThreshold", {
          threshold: formatThreshold(globalThreshold, language),
          ...AS_TEXT,
        })
      : t("admin:categories:card:threshold", {
          threshold: formatThreshold(category.thresholdPercentage, language),
          ...AS_TEXT,
        });

  return (
    <Box
      component="article"
      aria-label={name}
      sx={{
        ...STAGE_CARD,
        padding: { xs: 2, md: "22px 24px" },
        display: "flex",
        flexDirection: "column",
        gap: 2,
        ...(category.enabled ? {} : { backgroundColor: "#fafbfc" }),
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(280px, 400px)" },
          gap: { xs: 2, md: 3 },
          alignItems: "start",
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                flex: "none",
                borderRadius: "12px",
                display: "grid",
                placeItems: "center",
                color: tints.color,
                backgroundColor: tints.background,
                opacity: category.enabled ? 1 : 0.6,
              }}
            >
              <LayerCategoryIcon icon={category.icon} aria-hidden />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box
                component="h2"
                sx={{
                  margin: 0,
                  fontFamily: HEADING_FONT,
                  fontSize: 19,
                  fontWeight: 700,
                  lineHeight: 1.25,
                  color: FLOW_COLORS.ink,
                }}
              >
                {name}
              </Box>
              <Box component="span" sx={{ fontSize: 13, color: FLOW_COLORS.muted }}>
                {otherLanguage.toUpperCase()} · {localizedText(category.name, otherLanguage)}
              </Box>
            </Box>
            {!category.enabled && (
              <Chip size="small" label={t("admin:categories:card:disabled")} />
            )}
          </Box>

          {description && (
            <Box component="p" sx={{ margin: 0, fontSize: 15, color: FLOW_COLORS.ink }}>
              {description}
            </Box>
          )}
          <Box component="p" sx={{ margin: 0, fontSize: 14, color: FLOW_COLORS.ink2 }}>
            {t(`admin:categories:polarity:${category.polarity}`)}
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <ResultChip kind="neutral">{threshold}</ResultChip>
            {category.temporal && (
              <ResultChip kind="neutral">{t("admin:categories:card:temporal")}</ResultChip>
            )}
          </Box>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            padding: "12px 14px",
            borderRadius: "10px",
            backgroundColor: FLOW_COLORS.blue25,
          }}
        >
          {(["ok", "flagged"] as const).map((kind) => (
            <Box
              key={kind}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              <Box component="span" sx={{ fontSize: 13, color: FLOW_COLORS.muted }}>
                {t(`admin:categories:card:${kind}`)}
              </Box>
              <ResultChip kind={kind}>
                {kind === "ok" && <CheckIcon aria-hidden sx={{ fontSize: 14 }} />}
                {localizedText(category.resultLabels[kind], language)}
              </ResultChip>
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          paddingTop: 1.5,
          borderTop: `1px solid ${FLOW_COLORS.line}`,
          display: "flex",
          alignItems: "center",
          gap: { xs: 1, md: 2 },
          flexWrap: "wrap",
        }}
      >
        <Box
          component="span"
          sx={{ flex: "1 1 240px", fontSize: 14, color: FLOW_COLORS.ink2, minWidth: 0 }}
        >
          {category.layerCount === 0
            ? t("admin:categories:card:noLayers")
            : `${t("admin:categories:card:layers", { count: category.layerCount })} · ${t(
                "admin:categories:card:published",
                { count: category.publishedLayerCount }
              )}${
                layers.length
                  ? `: ${layers.map((layer) => adminLayerText(layer, "alias", language)).join(", ")}`
                  : ""
              }`}
        </Box>
        <FormControlLabel
          sx={{ marginRight: 0 }}
          control={
            <Switch
              checked={category.enabled}
              disabled={!editable || !!locks.enabled || updating}
              onChange={(_, checked) => onToggle(checked)}
              slotProps={{
                input: {
                  "aria-label": t("admin:categories:card:enabledLabel", { name, ...AS_TEXT }),
                },
              }}
            />
          }
          label={
            category.enabled
              ? t("admin:categories:card:enabled")
              : t("admin:categories:card:disabled")
          }
        />
        <Button size="small" onClick={onEdit} disabled={!editable}>
          {t("admin:categories:edit")}
        </Button>
        {editable && locks.enabled && (
          <FormHelperText sx={{ width: "100%", margin: 0 }}>
            {describeLock(locks.enabled, "enabled", t)}
          </FormHelperText>
        )}
      </Box>
    </Box>
  );
};
