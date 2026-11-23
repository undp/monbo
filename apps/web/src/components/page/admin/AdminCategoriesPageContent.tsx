"use client";

import React, { useCallback, useContext, useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { listAdminCategories, setAdminCategoryEnabled } from "@/api/adminCategories";
import { listAdminLayers } from "@/api/adminLayers";
import { getDeforestationThreshold } from "@/config/runtime";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { AdminCategories, AdminCategory, AdminLayer } from "@/interfaces/AdminLayer";
import { AS_TEXT } from "@/utils/asText";
import { localizedPath } from "@/utils/languageChange";
import { localizedText } from "@/utils/localizedText";
import { apiRefusalReason } from "./adminErrors";
import { adminLanguage } from "./adminLayerText";
import { AdminPageContainer } from "./AdminPageContainer";
import { CategoryCard } from "./CategoryCard";
import { categoryLocks } from "./categoryRules";

/**
 * The session's country's layer categories: one card each, one under the other,
 * with its enable switch. Creating and editing open the editor's page.
 */
export const AdminCategoriesPageContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = adminLanguage(i18n.language);
  const router = useRouter();
  const { session, withToken } = useContext(AdminSessionContext);
  const { openSnackbar } = useContext(SnackbarContext);
  const [data, setData] = useState<AdminCategories | null>(null);
  // Only names the layers in the cards and locks: the page works without them.
  const [layers, setLayers] = useState<AdminLayer[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  // The fallback of a category without its own threshold (D3), from GET /config.
  const globalThreshold = getDeforestationThreshold();

  useEffect(() => {
    if (!session) return;
    withToken(listAdminCategories)
      .then(setData)
      .catch(() => setLoadError(true));
    withToken(listAdminLayers)
      .then(setLayers)
      .catch(() => setLayers([]));
  }, [session, withToken]);

  const replace = useCallback((category: AdminCategory) => {
    setData((current) =>
      current && {
        ...current,
        categories: current.categories.some(({ id }) => id === category.id)
          ? current.categories.map((c) => (c.id === category.id ? category : c))
          : [...current.categories, category],
      }
    );
  }, []);

  const toggle = useCallback(
    async (category: AdminCategory, enabled: boolean) => {
      setUpdating(category.id);
      try {
        const updated = await withToken((token) =>
          setAdminCategoryEnabled(token, category.id, enabled)
        );
        replace(updated);
        openSnackbar({
          message: t(
            enabled ? "admin:categories:enabledDone" : "admin:categories:disabledDone",
            { name: localizedText(updated.name, language), ...AS_TEXT }
          ),
          type: "success",
        });
      } catch (e) {
        const reason = apiRefusalReason(e);
        openSnackbar({
          message: reason
            ? `${t("admin:categories:toggleError")} ${t("admin:layers:refused", { detail: reason, ...AS_TEXT })}`
            : t("admin:categories:toggleError"),
          type: "error",
        });
      } finally {
        setUpdating(null);
      }
    },
    [withToken, replace, openSnackbar, t, language]
  );

  const readable = data?.readable ?? true;

  return (
    <AdminPageContainer
      title={t("admin:categories:title")}
      subtitle={t("admin:categories:subtitle")}
      actions={
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={!data || !readable}
          onClick={() =>
            router.push(localizedPath("/admin/categories/new", i18n.language))
          }
        >
          {t("admin:categories:new")}
        </Button>
      }
    >
      {loadError && <Alert severity="error">{t("admin:categories:loadError")}</Alert>}
      {!data && !loadError && (
        <Box sx={{ display: "flex", justifyContent: "center", padding: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {data && (!readable || data.errors.length > 0) && (
        <Alert severity={readable ? "warning" : "error"}>
          {t(readable ? "admin:categories:rejected" : "admin:categories:unreadable")}
          <Box component="ul" sx={{ margin: 0, paddingLeft: 2.5 }}>
            {data.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </Box>
        </Alert>
      )}
      {data && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {data.categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              layers={layers.filter((layer) => layer.category_id === category.id)}
              locks={categoryLocks(category, layers, readable, language)}
              globalThreshold={globalThreshold}
              editable={readable}
              updating={updating === category.id}
              onToggle={(enabled) => toggle(category, enabled)}
              onEdit={() =>
                router.push(
                  localizedPath(`/admin/categories/${category.id}`, i18n.language)
                )
              }
            />
          ))}
        </Box>
      )}
    </AdminPageContainer>
  );
};
