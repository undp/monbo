"use client";

import React, { useCallback, useContext, useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import { listAdminCategories, setAdminCategoryEnabled } from "@/api/adminCategories";
import { listAdminLayers } from "@/api/adminLayers";
import { getDeforestationThreshold } from "@/config/runtime";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { AdminCategories, AdminCategory, AdminLayer } from "@/interfaces/AdminLayer";
import { localizedText } from "@/utils/localizedText";
import { apiRefusalReason } from "./adminErrors";
import { adminLanguage } from "./adminLayerText";
import { AdminPageContainer } from "./AdminPageContainer";
import { CategoryCard } from "./CategoryCard";
import { CategoryPanel } from "./CategoryPanel";
import { categoryLocks } from "./categoryRules";

// What the panel edits: a category, or a new one (null)
type Editing = { category: AdminCategory | null } | null;

/** The session's country's layer categories: cards, enable switches and the panel. */
export const AdminCategoriesPageContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = adminLanguage(i18n.language);
  const { session, withToken } = useContext(AdminSessionContext);
  const { openSnackbar } = useContext(SnackbarContext);
  const [data, setData] = useState<AdminCategories | null>(null);
  // Only names the layers in the cards and locks: the page works without them.
  const [layers, setLayers] = useState<AdminLayer[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
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
            { name: localizedText(updated.name, language) }
          ),
          type: "success",
        });
      } catch (e) {
        const reason = apiRefusalReason(e);
        openSnackbar({
          message: reason
            ? `${t("admin:categories:toggleError")} ${t("admin:layers:refused", { detail: reason })}`
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
          onClick={() => setEditing({ category: null })}
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
        <Alert severity={readable ? "warning" : "error"} sx={{ marginBottom: 3 }}>
          {t(readable ? "admin:categories:rejected" : "admin:categories:unreadable")}
          <Box component="ul" sx={{ margin: 0, paddingLeft: 2.5 }}>
            {data.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </Box>
        </Alert>
      )}
      {data && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
            gap: 2,
          }}
        >
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
              onEdit={() => setEditing({ category })}
            />
          ))}
        </Box>
      )}
      <CategoryPanel
        open={editing !== null}
        category={editing?.category ?? null}
        categories={data?.categories ?? []}
        locks={categoryLocks(editing?.category ?? null, layers, readable, language)}
        globalThreshold={globalThreshold}
        onClose={() => setEditing(null)}
        onSaved={(category) => {
          replace(category);
          setEditing(null);
        }}
      />
    </AdminPageContainer>
  );
};
