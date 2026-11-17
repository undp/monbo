"use client";

import React, { Fragment, useCallback, useContext, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { listAdminCategories } from "@/api/adminCategories";
import {
  AdminApiError,
  listAdminLayers,
  setAdminLayerEnabled,
} from "@/api/adminLayers";
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
import { layerBlocker, layerVisibility } from "./layerVisibility";
import { blockerFix, blockerReason } from "./LayerVisibilityNotice";

const COLUMNS = 8;

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
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("admin:layers:columns:id")}</TableCell>
                <TableCell>{t("admin:layers:columns:name")}</TableCell>
                <TableCell>{t("admin:layers:columns:alias")}</TableCell>
                <TableCell>{t("admin:layers:columns:category")}</TableCell>
                <TableCell>{t("admin:layers:columns:raster")}</TableCell>
                <TableCell align="right">
                  {t("admin:layers:columns:version")}
                </TableCell>
                <TableCell align="center">
                  {t("admin:layers:columns:published")}
                </TableCell>
                <TableCell />
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
                    <TableRow
                      hover
                      sx={blocked ? { "& > td": { borderBottom: 0 } } : undefined}
                    >
                      <TableCell>{layer.id}</TableCell>
                      <TableCell>{layerText(layer, "name", language)}</TableCell>
                      <TableCell>{layerText(layer, "alias", language)}</TableCell>
                      <TableCell>
                        <LayerCategoryCell layer={layer} categories={categories} />
                      </TableCell>
                      <TableCell>
                        {layer.has_raster ? (
                          layer.raster_filename
                        ) : (
                          <Chip
                            size="small"
                            color="warning"
                            label={t("admin:layers:noRaster")}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">{layer.version}</TableCell>
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
                          startIcon={<EditIcon />}
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
                          <Alert severity="warning" sx={{ paddingY: 0 }}>
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
                          </Alert>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AdminPageContainer>
  );
};
