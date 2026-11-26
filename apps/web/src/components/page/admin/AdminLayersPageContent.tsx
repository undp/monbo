"use client";

import React, { Fragment, useCallback, useContext, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { listAdminCategories } from "@/api/adminCategories";
import {
  AdminApiError,
  listAdminLayers,
  setAdminLayerEnabled,
} from "@/api/adminLayers";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { FLOW_TABLE_FRAME, FLOW_TABLE_ID, FLOW_TABLE_SX } from "@/components/page/flow/flowTable";
import { CategoryChip } from "@/components/reusable/CategoryChip";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { AdminCategories, AdminLayer } from "@/interfaces/AdminLayer";
import { AS_TEXT } from "@/utils/asText";
import { localizedPath } from "@/utils/languageChange";
import { localizedText } from "@/utils/localizedText";
import { apiRefusalReason } from "./adminErrors";
import { adminLanguage, adminLayerText as layerText, categoryName } from "./adminLayerText";
import { AdminPageContainer } from "./AdminPageContainer";
import { layerPeriod } from "./layerPeriod";
import { layerBlocker, layerVisibility } from "./layerVisibility";
import { blockerFix, blockerReason } from "./LayerVisibilityNotice";

const COLUMNS = 8;

// Read by screen readers, not shown
const VISUALLY_HIDDEN = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

/** An amber pill, as the mockup's states: a layer without its raster. */
const PILL = {
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: "999px",
  fontSize: 12.5,
  fontWeight: 700,
  whiteSpace: "nowrap",
  color: FLOW_COLORS.warn,
  backgroundColor: FLOW_COLORS.warnBackground,
} as const;

/** A layer's period: "2020 → 2023", "Current", or "—" when it can't be told. */
const PeriodText: React.FC<{ layer: AdminLayer; categories: AdminCategories | null }> = ({
  layer,
  categories,
}) => {
  const { t } = useTranslation();
  const period = layerPeriod(layer, categories);
  if (period.kind === "years") return <>{`${period.baseline} → ${period.comparedAgainst}`}</>;
  if (period.kind === "current") return <>{t("admin:layers:period:current")}</>;
  return <>—</>;
};

/** A layer's category: its chip, or its raw id in grey when it doesn't resolve. */
const LayerCategoryCell: React.FC<{
  layer: AdminLayer;
  categories: AdminCategories | null;
}> = ({ layer, categories }) => {
  const { t, i18n } = useTranslation();
  const category = categories?.categories.find(({ id }) => id === layer.category_id);
  if (layer.category_issue || !category) {
    return (
      <CategoryChip
        name={
          layer.category_issue
            ? t(`admin:layers:categoryIssue:${layer.category_issue}`, {
                category: layer.category_id,
                ...AS_TEXT,
              })
            : layer.category_id
        }
        icon={null}
        color={null}
      />
    );
  }
  return (
    <CategoryChip
      name={localizedText(category.name, i18n.language)}
      icon={category.icon}
      color={category.color}
    />
  );
};

export const AdminLayersPageContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = adminLanguage(i18n.language);
  const router = useRouter();
  const { session, withToken } = useContext(AdminSessionContext);
  const { openSnackbar } = useContext(SnackbarContext);
  const [layers, setLayers] = useState<AdminLayer[] | null>(null);
  // Only names and colors the category column: the list works without them.
  const [categories, setCategories] = useState<AdminCategories | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);

  useEffect(() => {
    if (!session) return;
    withToken(listAdminLayers)
      .then(setLayers)
      .catch(() => setLoadError(true));
    withToken(listAdminCategories)
      .then(setCategories)
      .catch(() => setCategories(null));
  }, [session, withToken]);

  const toggle = useCallback(
    async (layer: AdminLayer, enabled: boolean) => {
      // Publishing: say why it can't be published instead of asking the API, when
      // the layer already tells (the raster is the API's 409, below).
      const blocker = enabled ? layerBlocker(layer) : null;
      if (blocker && blocker !== "missing_raster") {
        openSnackbar({
          message: t("admin:layers:cannotPublish", {
            reason: blockerReason(
              blocker,
              categoryName(categories, layer.category_id, language),
              t
            ),
            fix: blockerFix(blocker, false, t),
            ...AS_TEXT,
          }),
          type: "warning",
        });
        return;
      }
      setUpdating(layer.id);
      try {
        const updated = await withToken((token) =>
          setAdminLayerEnabled(token, layer.id, enabled)
        );
        setLayers((current) =>
          current?.map((l) => (l.id === updated.id ? updated : l)) ?? null
        );
        openSnackbar({
          message: t(enabled ? "admin:layers:published" : "admin:layers:hidden", {
            alias: layerText(updated, "alias", language),
            ...AS_TEXT,
          }),
          type: "success",
        });
      } catch (e) {
        const needsRaster = e instanceof AdminApiError && e.status === 409;
        // A rule the list didn't foresee (e.g. another admin's change): the API's reason.
        const reason = needsRaster ? null : apiRefusalReason(e);
        openSnackbar({
          message: needsRaster
            ? t("admin:layers:needsRaster")
            : reason
              ? `${t("admin:layers:toggleError")} ${t("admin:layers:refused", { detail: reason, ...AS_TEXT })}`
              : t("admin:layers:toggleError"),
          type: needsRaster ? "warning" : "error",
        });
      } finally {
        setUpdating(null);
      }
    },
    [withToken, openSnackbar, t, language, categories]
  );

  return (
    <AdminPageContainer
      title={t("admin:layers:title")}
      subtitle={t("admin:layers:subtitle")}
      actions={
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push(localizedPath("/admin/layers/new", i18n.language))}
        >
          {t("admin:layers:new")}
        </Button>
      }
    >
      {loadError && <Alert severity="error">{t("admin:layers:loadError")}</Alert>}
      {!layers && !loadError && (
        <Box sx={{ display: "flex", justifyContent: "center", padding: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {layers && (
        <Box sx={FLOW_TABLE_FRAME}>
          <Table sx={FLOW_TABLE_SX}>
            <TableHead>
              <TableRow>
                <TableCell>{t("admin:layers:columns:id")}</TableCell>
                <TableCell>{t("admin:layers:columns:layer")}</TableCell>
                <TableCell>{t("admin:layers:columns:category")}</TableCell>
                <TableCell>{t("admin:layers:columns:period")}</TableCell>
                <TableCell>{t("admin:layers:columns:raster")}</TableCell>
                <TableCell align="right">{t("admin:layers:columns:version")}</TableCell>
                <TableCell align="center">{t("admin:layers:columns:published")}</TableCell>
                <TableCell>
                  <Box component="span" sx={VISUALLY_HIDDEN}>
                    {t("admin:layers:columns:actions")}
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {layers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS}>{t("admin:layers:empty")}</TableCell>
                </TableRow>
              )}
              {layers.map((layer) => {
                const visibility = layerVisibility(layer);
                const blocked = visibility.status === "blocked";
                return (
                  <Fragment key={layer.id}>
                    <TableRow sx={blocked ? { "& > td": { borderBottom: 0 } } : undefined}>
                      <TableCell sx={FLOW_TABLE_ID}>{layer.id}</TableCell>
                      <TableCell sx={{ minWidth: 200 }}>
                        <Box component="span" sx={{ display: "block", fontWeight: 700 }}>
                          {layerText(layer, "name", language)}
                        </Box>
                        <Box
                          component="span"
                          sx={{ display: "block", fontSize: 13, color: FLOW_COLORS.muted }}
                        >
                          {layerText(layer, "alias", language)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <LayerCategoryCell layer={layer} categories={categories} />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        <PeriodText layer={layer} categories={categories} />
                      </TableCell>
                      <TableCell>
                        {layer.has_raster ? (
                          layer.raster_filename
                        ) : (
                          <Box component="span" sx={PILL}>
                            {t("admin:layers:noRaster")}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="right">{layer.version ?? "—"}</TableCell>
                      <TableCell align="center">
                        <Switch
                          checked={layer.enabled}
                          disabled={updating === layer.id}
                          onChange={(_, checked) => toggle(layer, checked)}
                          slotProps={{
                            input: {
                              "aria-label": `${t("admin:layers:columns:published")} ${layerText(layer, "alias", language)}`,
                            },
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() =>
                            router.push(
                              localizedPath(`/admin/layers/${layer.id}`, i18n.language)
                            )
                          }
                        >
                          {t("admin:layers:edit")}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {visibility.status === "blocked" && (
                      // An enabled layer the public app hides: say why, and how to fix it.
                      <TableRow>
                        <TableCell colSpan={COLUMNS} sx={{ paddingTop: 0 }}>
                          <Box
                            role="note"
                            sx={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 1,
                              padding: "8px 12px",
                              borderRadius: "8px",
                              fontSize: 13.5,
                              color: FLOW_COLORS.warn,
                              backgroundColor: FLOW_COLORS.warnBackground,
                            }}
                          >
                            <WarningAmberRoundedIcon sx={{ fontSize: 18 }} aria-hidden />
                            <span>
                              {t("admin:layers:status:blocked", {
                                alias: layerText(layer, "alias", language),
                                reason: blockerReason(
                                  visibility.reason,
                                  categoryName(categories, layer.category_id, language),
                                  t
                                ),
                                ...AS_TEXT,
                              })}{" "}
                              {blockerFix(visibility.reason, true, t)}
                            </span>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
    </AdminPageContainer>
  );
};
