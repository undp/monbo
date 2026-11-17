"use client";

import React from "react";
import { Box, Button, Chip, FormControlLabel, FormHelperText, Paper, Switch } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import { useTranslation } from "react-i18next";
import { LayerCategoryIcon } from "@/components/reusable/LayerCategoryIcon";
import { ResultChip } from "@/components/reusable/ResultChip";
import { Text } from "@/components/reusable/Text";
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

/** One category of the country, as the mockup's admin cards show it. */
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
    <Paper
      component="article"
      aria-label={name}
      sx={{
        padding: 2.25,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        borderLeft: `4px solid ${tints.color}`,
        ...(category.enabled ? {} : { backgroundColor: "#fafafa" }),
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            flex: "none",
            borderRadius: "10px",
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
          <Text variant="h6" component="h2" bold sx={{ lineHeight: 1.2 }}>
            {name}
          </Text>
          <Text variant="caption" color="secondary">
            {otherLanguage.toUpperCase()} · {localizedText(category.name, otherLanguage)}
          </Text>
        </Box>
        {!category.enabled && (
          <Chip size="small" label={t("admin:categories:card:disabled")} />
        )}
      </Box>

      {description && (
        <Text variant="body2" color="secondary">
          {description}
        </Text>
      )}
      <Text variant="body2">{t(`admin:categories:polarity:${category.polarity}`)}</Text>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        <ResultChip kind="neutral">{threshold}</ResultChip>
        {category.temporal && (
          <ResultChip kind="neutral">{t("admin:categories:card:temporal")}</ResultChip>
        )}
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
          padding: 1.25,
          borderRadius: 2,
          backgroundColor: "#f7fafc",
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
            <Text variant="caption" color="secondary">
              {t(`admin:categories:card:${kind}`)}
            </Text>
            <ResultChip kind={kind}>
              {kind === "ok" && <CheckIcon aria-hidden sx={{ fontSize: 14 }} />}
              {localizedText(category.resultLabels[kind], language)}
            </ResultChip>
          </Box>
        ))}
      </Box>

      <Text variant="body2" color="secondary">
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
      </Text>

      <Box
        sx={{
          marginTop: "auto",
          paddingTop: 1,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <FormControlLabel
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
        <Button size="small" startIcon={<EditIcon />} onClick={onEdit} disabled={!editable}>
          {t("admin:categories:edit")}
        </Button>
        {editable && locks.enabled && (
          <FormHelperText sx={{ width: "100%", margin: 0 }}>
            {describeLock(locks.enabled, "enabled", t)}
          </FormHelperText>
        )}
      </Box>
    </Paper>
  );
};
