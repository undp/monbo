"use client";

import React, { useCallback, useContext, useEffect, useState } from "react";
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
import {
  AdminApiError,
  listAdminLayers,
  setAdminLayerEnabled,
} from "@/api/adminLayers";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { AdminLanguage, AdminLayer } from "@/interfaces/AdminLayer";
import { localizedPath } from "@/utils/languageChange";
import { AdminPageContainer } from "./AdminPageContainer";

const layerText = (
  layer: AdminLayer,
  key: "name" | "alias",
  language: AdminLanguage
) =>
  layer.attributes[language]?.[key] ??
  layer.attributes[language === "es" ? "en" : "es"]?.[key] ??
  `#${layer.id}`;

export const AdminLayersPageContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = (i18n.language === "en" ? "en" : "es") as AdminLanguage;
  const router = useRouter();
  const { session, withToken } = useContext(AdminSessionContext);
  const { openSnackbar } = useContext(SnackbarContext);
  const [layers, setLayers] = useState<AdminLayer[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);

  useEffect(() => {
    if (!session) return;
    withToken(listAdminLayers)
      .then(setLayers)
      .catch(() => setLoadError(true));
  }, [session, withToken]);

  const toggle = useCallback(
    async (layer: AdminLayer, enabled: boolean) => {
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
        openSnackbar({
          message: t(
            needsRaster ? "admin:layers:needsRaster" : "admin:layers:toggleError"
          ),
          type: needsRaster ? "warning" : "error",
        });
      } finally {
        setUpdating(null);
      }
    },
    [withToken, openSnackbar, t, language]
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
                  <TableCell colSpan={7}>{t("admin:layers:empty")}</TableCell>
                </TableRow>
              )}
              {layers.map((layer) => (
                <TableRow key={layer.id} hover>
                  <TableCell>{layer.id}</TableCell>
                  <TableCell>{layerText(layer, "name", language)}</TableCell>
                  <TableCell>{layerText(layer, "alias", language)}</TableCell>
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
                        router.push(localizedPath(`/admin/layers/${layer.id}`, i18n.language))
                      }
                    >
                      {t("admin:layers:edit")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </AdminPageContainer>
  );
};
