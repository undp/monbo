"use client";

import React from "react";
import { Alert, AlertTitle } from "@mui/material";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { AdminLayer } from "@/interfaces/AdminLayer";
import { AS_TEXT } from "@/utils/asText";
import { LayerBlocker, layerVisibility } from "./layerVisibility";

/** Why a layer can't be public, in a sentence ("its category … is disabled."). */
export const blockerReason = (reason: LayerBlocker, category: string, t: TFunction) =>
  t(`admin:layers:status:reasons:${reason}`, { category, ...AS_TEXT });

/** How to fix it; a published layer must be hidden first for some fixes. */
export const blockerFix = (reason: LayerBlocker, published: boolean, t: TFunction) =>
  t(`admin:layers:status:${published ? "fixesPublished" : "fixes"}:${reason}`);

interface Props {
  layer: AdminLayer;
  /** The layer's category as the admin knows it (its name, or its raw id). */
  categoryName: string;
}

/**
 * Above the layer form: why the layer isn't public and how to fix it. A published
 * layer that the public app hides is a warning; a hidden one only lists what would
 * stop publishing it. A missing raster is left to the raster section, which guides
 * the upload.
 */
export const LayerVisibilityAlert: React.FC<Props> = ({ layer, categoryName }) => {
  const { t } = useTranslation();
  const visibility = layerVisibility(layer);
  if (visibility.status === "public" || visibility.reason === null) return null;
  if (visibility.status === "hidden" && visibility.reason === "missing_raster") return null;
  const blocked = visibility.status === "blocked";
  return (
    <Alert severity={blocked ? "warning" : "info"}>
      <AlertTitle>
        {t(blocked ? "admin:form:visibility:blocked" : "admin:form:visibility:hidden")}
      </AlertTitle>
      {blockerReason(visibility.reason, categoryName, t)}{" "}
      {blockerFix(visibility.reason, blocked, t)}
    </Alert>
  );
};
