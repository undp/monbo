"use client";

import React from "react";
import { Box } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { useTranslation } from "react-i18next";
import { CategoryChip } from "@/components/reusable/CategoryChip";
import { ResultChip } from "@/components/reusable/ResultChip";
import { PageEyebrow } from "@/components/page/flow/PageEyebrow";
import { STAGE_CARD } from "@/components/page/flow/flowStyles";
import { Text } from "@/components/reusable/Text";
import { ADMIN_LANGUAGES, AdminLanguage } from "@/interfaces/AdminLayer";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import { AS_TEXT } from "@/utils/asText";
import { NO_CATEGORY_COLOR } from "@/utils/categoryColors";
import { layerResult } from "@/utils/layerCategories";
import type { Polarity } from "@/utils/layerResults";
import { formatThreshold } from "@/utils/numbers";
import type { CategoryFormValues } from "./categoryFormState";

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
// The mockup's example finding, in percent
const EXAMPLE_FINDING = 18;

/**
 * The finding of the example polygon with findings, in percent: above the threshold
 * so it is flagged, or null when nothing can be (a threshold of 100).
 */
export const exampleFinding = (threshold: number): number | null =>
  threshold >= 100
    ? null
    : threshold < EXAMPLE_FINDING
      ? EXAMPLE_FINDING
      : Math.min(100, Math.floor(threshold) + 5);

/** A polygon's coverage (`value`) for a finding (0-100) under a polarity. */
const coverage = (finding: number, polarity: Polarity) =>
  polarity === "avoid" ? finding / 100 : 1 - finding / 100;

/** The threshold the preview uses: the category's own when valid, else the global one. */
const previewThreshold = (values: CategoryFormValues, globalThreshold: number) => {
  if (values.useGlobalThreshold) return globalThreshold;
  const own = Number(values.threshold);
  return values.threshold.trim() !== "" && own >= 0 && own <= 100 ? own : globalThreshold;
};

interface Props {
  values: CategoryFormValues;
  /** The global threshold of GET /config, in percent. */
  globalThreshold: number;
}

/**
 * The category chip and two example polygons, one without findings and one with,
 * in Spanish and English. Each example is classified by the app's own reading of a
 * result (`layerResult`), so the chips show what the analysis will show: switching
 * the polarity changes which polygon gets the observation.
 */
export const CategoryPreview: React.FC<Props> = ({ values, globalThreshold }) => {
  const { t, i18n } = useTranslation();
  const color = COLOR_PATTERN.test(values.color.trim()) ? values.color.trim() : NO_CATEGORY_COLOR;
  const name = (language: AdminLanguage) =>
    values.name[language].trim() || t("admin:categories:form:preview:unnamed");

  const polarity = values.polarity;
  const threshold = previewThreshold(values, globalThreshold);
  const flaggedFinding = exampleFinding(threshold);

  const category: LayerCategory | null = polarity && {
    id: values.id || "preview",
    name: { es: name("es"), en: name("en") },
    description: values.description,
    icon: values.icon,
    color,
    polarity,
    thresholdPercentage: threshold,
    temporal: values.temporal,
    // Until a text is typed, the chip shows what it stands for.
    resultLabels: {
      ok: {
        es: values.resultLabels.ok.es.trim() || t("admin:categories:form:ok"),
        en: values.resultLabels.ok.en.trim() || t("admin:categories:form:ok"),
      },
      flagged: {
        es: values.resultLabels.flagged.es.trim() || t("admin:categories:form:flagged"),
        en: values.resultLabels.flagged.en.trim() || t("admin:categories:form:flagged"),
      },
    },
  };

  const example = (finding: number) => {
    if (!category) return null;
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        <Text variant="body2" color="secondary">
          {t(`admin:categories:form:preview:${category.polarity}`, {
            finding: formatThreshold(finding, i18n.language),
            ...AS_TEXT,
          })}
        </Text>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {ADMIN_LANGUAGES.map((language) => {
            const result = layerResult(
              coverage(finding, category.polarity),
              category,
              t,
              language
            );
            // The chip follows the class the classifier returns, not the example's intent.
            return result.resultClass === "flagged" ? (
              <ResultChip key={language} kind="flagged">
                {`${result.findingText} · ${result.label}`}
              </ResultChip>
            ) : (
              <ResultChip key={language} kind="ok">
                <CheckIcon aria-hidden sx={{ fontSize: 14 }} />
                {result.label}
              </ResultChip>
            );
          })}
        </Box>
      </Box>
    );
  };

  return (
    <Box
      role="region"
      aria-label={t("admin:categories:form:preview:title")}
      sx={{
        ...STAGE_CARD,
        padding: { xs: 2, md: "20px 22px" },
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <PageEyebrow>{t("admin:categories:form:preview:title")}</PageEyebrow>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {ADMIN_LANGUAGES.map((language) => (
          <CategoryChip key={language} name={name(language)} icon={values.icon} color={color} />
        ))}
      </Box>
      {category ? (
        <>
          {example(0)}
          {flaggedFinding === null ? (
            <Text variant="body2" color="secondary">
              {t("admin:categories:form:preview:nothingFlagged")}
            </Text>
          ) : (
            example(flaggedFinding)
          )}
        </>
      ) : (
        <Text variant="body2" color="secondary">
          {t("admin:categories:form:preview:choosePolarity")}
        </Text>
      )}
    </Box>
  );
};
