"use client";

import React, { useCallback, useContext, useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { FormProvider, useForm } from "react-hook-form";
import { listAdminCategories } from "@/api/adminCategories";
import {
  AdminApiError,
  createAdminLayer,
  listAdminLayers,
  updateAdminLayer,
} from "@/api/adminLayers";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { AdminCategories, AdminLayer } from "@/interfaces/AdminLayer";
import { AS_TEXT } from "@/utils/asText";
import {
  dropKept,
  keepForLanguageChange,
  settleLanguageChange,
  localizedPath,
  takeOverOnLanguageChange,
} from "@/utils/languageChange";
import { apiRefusalReason, describeValidationError } from "./adminErrors";
import { categoryName } from "./adminLayerText";
import { AdminPageContainer } from "./AdminPageContainer";
import { LayerForm, Section } from "./LayerForm";
import { LayerVisibilityAlert } from "./LayerVisibilityNotice";
import { LayerFormValues, toFormValues, toLayerInput } from "./layerFormState";
import { RasterUploadSection } from "./RasterUploadSection";

interface Props {
  // Omitted to create a new layer.
  layerId?: number;
}

// The Raster section's anchor: creating a layer leads there, its next step.
export const RASTER_SECTION_ID = "raster";

export const AdminLayerEditorPageContent: React.FC<Props> = ({ layerId }) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { session, withToken } = useContext(AdminSessionContext);
  const { openSnackbar } = useContext(SnackbarContext);
  const isNew = layerId === undefined;
  const [layer, setLayer] = useState<AdminLayer | null>(null);
  const [notFound, setNotFound] = useState(false);
  // The country's categories: the form's choices, and whether a category has years.
  // The form waits for them, because its rules are registered when it mounts.
  const [categories, setCategories] = useState<AdminCategories | null>(null);
  const [categoriesError, setCategoriesError] = useState(false);
  // Errors show up on the first save attempt and then follow every edit.
  const form = useForm<LayerFormValues>({
    defaultValues: toFormValues(),
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { reset, handleSubmit, formState, getValues, subscribe } = form;

  // Changing the language remounts the page: keep what was typed (languageChange.ts).
  const draftKey = `admin-layer-form:${layerId ?? "new"}`;
  const [draft] = useState(() => takeOverOnLanguageChange<LayerFormValues>(draftKey));
  useEffect(
    () =>
      subscribe({
        formState: { values: true },
        callback: () => keepForLanguageChange(draftKey, getValues()),
      }),
    [draftKey, subscribe, getValues]
  );
  useEffect(() => {
    settleLanguageChange(draftKey);
    return () => dropKept(draftKey);
  }, [draftKey]);

  const load = useCallback(async () => {
    if (isNew) return null;
    const layers = await withToken(listAdminLayers);
    const found = layers.find((l) => l.id === layerId) ?? null;
    setNotFound(!found);
    setLayer(found);
    return found;
  }, [isNew, layerId, withToken]);

  useEffect(() => {
    if (!session) return;
    withToken(listAdminCategories)
      .then(setCategories)
      .catch(() => setCategoriesError(true));
  }, [session, withToken]);

  useEffect(() => {
    if (!session) return;
    load()
      .then((found) => {
        if (found) reset(toFormValues(found));
        // On top of the stored values, so the edits still count as changes.
        if (draft) reset(draft, { keepDefaultValues: true });
      })
      .catch(() => setNotFound(true));
  }, [session, load, reset, draft]);

  // After creating a layer: bring its next step, the raster, into view once it
  // renders, then drop the anchor so later reloads of the layer don't scroll.
  const hasLayer = layer !== null;
  useEffect(() => {
    if (!hasLayer || window.location.hash !== `#${RASTER_SECTION_ID}`) return;
    document
      .getElementById(RASTER_SECTION_ID)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", window.location.pathname);
  }, [hasLayer]);

  // After a raster upload: refresh the layer without discarding form edits.
  const reload = useCallback(() => {
    load().catch(() => setNotFound(true));
  }, [load]);

  const save = handleSubmit(
    async (values) => {
      const category =
        categories?.categories.find(({ id }) => id === values.category_id) ?? null;
      const input = toLayerInput(values, category);
      try {
        if (isNew) {
          const created = await withToken((token) => createAdminLayer(token, input));
          openSnackbar({ message: t("admin:form:created"), type: "success" });
          router.replace(
            localizedPath(`/admin/layers/${created.id}#${RASTER_SECTION_ID}`, i18n.language)
          );
        } else {
          const updated = await withToken((token) =>
            updateAdminLayer(token, layerId, input)
          );
          setLayer(updated);
          reset(toFormValues(updated));
          openSnackbar({ message: t("admin:form:saved"), type: "success" });
        }
      } catch (e) {
        const validationDetails =
          e instanceof AdminApiError && e.status === 422
            ? describeValidationError(e)
            : null;
        const issue =
          e instanceof AdminApiError &&
          e.status === 409 &&
          typeof e.detail === "object" &&
          e.detail !== null &&
          "code" in e.detail
            ? (e.detail as { code: string; params?: Record<string, unknown> })
            : null;
        const issueDetails =
          issue?.code === "resolution_mismatch" ||
          issue?.code === "resolution_varies" ||
          issue?.code === "resolution_unavailable"
            ? t(`admin:raster:issues:${issue.code}`, { ...issue.params, ...AS_TEXT })
            : null;
        // Any other refusal says why, as on the other admin pages: a rule the form
        // didn't foresee (another admin's change) or a 409 such as an unreadable raster.
        const reason = validationDetails || issueDetails ? null : apiRefusalReason(e);
        const refusal = reason
          ? t("admin:layers:refused", { detail: reason, ...AS_TEXT })
          : null;
        const details = validationDetails ?? issueDetails ?? refusal;
        openSnackbar({
          message: details
            ? `${t("admin:form:saveError")} ${details}`
            : t("admin:form:saveError"),
          type: "error",
        });
      }
    },
    () => openSnackbar({ message: t("admin:form:errors:invalid"), type: "warning" })
  );

  const title = isNew
    ? t("admin:form:createTitle")
    : t("admin:form:editTitle", { id: layerId });

  const back = (
    <Button
      startIcon={<ArrowBackIcon />}
      onClick={() => router.push(localizedPath("/admin/layers", i18n.language))}
    >
      {t("admin:form:back")}
    </Button>
  );

  if (notFound) {
    return (
      <AdminPageContainer title={title} actions={back}>
        <Alert severity="warning">{t("admin:form:notFound")}</Alert>
      </AdminPageContainer>
    );
  }

  const categoriesReady = categories !== null || categoriesError;
  if ((!isNew && !layer) || !categoriesReady) {
    return (
      <AdminPageContainer title={title} actions={back}>
        <Box sx={{ display: "flex", justifyContent: "center", padding: 6 }}>
          <CircularProgress />
        </Box>
      </AdminPageContainer>
    );
  }

  return (
    <AdminPageContainer title={title} actions={back}>
      {categoriesError && (
        <Alert severity="error" sx={{ marginBottom: 3 }}>
          {t("admin:form:categoriesLoadError")}
        </Alert>
      )}
      {categories && !categories.readable && (
        <Alert severity="error" sx={{ marginBottom: 3 }}>
          {t("admin:form:categoriesUnreadable")}
        </Alert>
      )}
      {layer && (
        <LayerVisibilityAlert
          layer={layer}
          categoryName={categoryName(categories, layer.category_id, i18n.language)}
        />
      )}
      <FormProvider {...form}>
        <form onSubmit={save} noValidate>
          <LayerForm categories={categories?.categories ?? []} layer={layer} />
          <Box sx={{ display: "flex", justifyContent: "flex-end", marginBottom: 3 }}>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={formState.isSubmitting}
            >
              {formState.isSubmitting ? t("admin:form:saving") : t("admin:form:save")}
            </Button>
          </Box>
        </form>
      </FormProvider>
      {layer && (
        <Section id={RASTER_SECTION_ID} title={t("admin:form:sections:raster")}>
          <RasterUploadSection
            layer={layer}
            categoryName={categoryName(categories, layer.category_id, i18n.language)}
            onLayerChanged={reload}
          />
        </Section>
      )}
    </AdminPageContainer>
  );
};
