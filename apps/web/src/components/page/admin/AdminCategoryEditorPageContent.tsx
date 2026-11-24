"use client";

import React, { useContext, useEffect, useState } from "react";
import { Alert, Box, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { listAdminCategories } from "@/api/adminCategories";
import { listAdminLayers } from "@/api/adminLayers";
import { getDeforestationThreshold } from "@/config/runtime";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { AdminCategories, AdminLayer } from "@/interfaces/AdminLayer";
import { localizedPath } from "@/utils/languageChange";
import { adminLanguage } from "./adminLayerText";
import { AdminPageContainer } from "./AdminPageContainer";
import { CategoryForm } from "./CategoryForm";
import { categoryLocks } from "./categoryRules";

const LIST_PATH = "/admin/categories";

interface Props {
  /** The category to edit; none to create one. */
  categoryId?: string;
}

/**
 * Creates or edits one of the session's country's categories on a page of its own
 * (mockup v2, "Nueva categoría"). Saving or cancelling goes back to the list.
 */
export const AdminCategoryEditorPageContent: React.FC<Props> = ({ categoryId }) => {
  const { t, i18n } = useTranslation();
  const language = adminLanguage(i18n.language);
  const router = useRouter();
  const { session, withToken } = useContext(AdminSessionContext);
  const [data, setData] = useState<AdminCategories | null>(null);
  // Only names the layers of the locks: the editor works without them.
  const [layers, setLayers] = useState<AdminLayer[]>([]);
  const [loadError, setLoadError] = useState(false);
  // The fallback of a category without its own threshold (D3), from GET /config.
  const globalThreshold = getDeforestationThreshold();
  const isNew = categoryId === undefined;

  useEffect(() => {
    if (!session) return;
    withToken(listAdminCategories)
      .then(setData)
      .catch(() => setLoadError(true));
    withToken(listAdminLayers)
      .then(setLayers)
      .catch(() => setLayers([]));
  }, [session, withToken]);

  const backToList = () => router.push(localizedPath(LIST_PATH, i18n.language));
  const category = isNew
    ? null
    : (data?.categories.find(({ id }) => id === categoryId) ?? null);

  const content = () => {
    if (loadError) return <Alert severity="error">{t("admin:categories:loadError")}</Alert>;
    if (!data) {
      return (
        <Box sx={{ display: "flex", justifyContent: "center", padding: 6 }}>
          <CircularProgress />
        </Box>
      );
    }
    // The list offers no writes then, and neither does its editor.
    if (!data.readable) {
      return (
        <Alert severity="error">
          {t("admin:categories:unreadable")}
          <Box component="ul" sx={{ margin: 0, paddingLeft: 2.5 }}>
            {data.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </Box>
        </Alert>
      );
    }
    if (!isNew && !category) {
      return <Alert severity="warning">{t("admin:categories:editor:notFound")}</Alert>;
    }
    return (
      <CategoryForm
        category={category}
        locks={categoryLocks(category, layers, true, language)}
        globalThreshold={globalThreshold}
        onCancel={backToList}
        onSaved={backToList}
      />
    );
  };

  return (
    <AdminPageContainer
      title={
        isNew ? t("admin:categories:form:createTitle") : t("admin:categories:form:editTitle")
      }
      back={{ label: t("admin:categories:editor:back"), path: LIST_PATH }}
    >
      {content()}
    </AdminPageContainer>
  );
};
