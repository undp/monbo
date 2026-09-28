"use client";

import React, { useCallback, useContext, useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { FormProvider, useForm } from "react-hook-form";
import {
  AdminApiError,
  createAdminLayer,
  listAdminLayers,
  updateAdminLayer,
} from "@/api/adminLayers";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { AdminLayer } from "@/interfaces/AdminLayer";
import { AdminPageContainer } from "./AdminPageContainer";
import { LayerForm, Section } from "./LayerForm";
import { LayerFormValues, toFormValues, toLayerInput } from "./layerFormState";
import { RasterUploadSection } from "./RasterUploadSection";

interface Props {
  // Omitted to create a new layer.
  layerId?: number;
}

/** FastAPI 422 details as readable lines (the API's own English messages). */
const describeValidationError = (error: AdminApiError) =>
  Array.isArray(error.detail)
    ? error.detail
        .map((d: { loc?: unknown[]; msg?: string }) =>
          [d.loc?.slice(1).join("."), d.msg].filter(Boolean).join(": ")
        )
        .join("; ")
    : null;

export const AdminLayerEditorPageContent: React.FC<Props> = ({ layerId }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { session, withToken } = useContext(AdminSessionContext);
  const { openSnackbar } = useContext(SnackbarContext);
  const isNew = layerId === undefined;
  const [layer, setLayer] = useState<AdminLayer | null>(null);
  const [notFound, setNotFound] = useState(false);
  // Errors show up on the first save attempt and then follow every edit.
  const form = useForm<LayerFormValues>({
    defaultValues: toFormValues(),
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { reset, handleSubmit, formState } = form;

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
    load()
      .then((found) => found && reset(toFormValues(found)))
      .catch(() => setNotFound(true));
  }, [session, load, reset]);

  // After a raster upload: refresh the layer without discarding form edits.
  const reload = useCallback(() => {
    load().catch(() => setNotFound(true));
  }, [load]);

  const save = handleSubmit(
    async (values) => {
      const input = toLayerInput(values);
      try {
        if (isNew) {
          const created = await withToken((token) => createAdminLayer(token, input));
          openSnackbar({ message: t("admin:form:created"), type: "success" });
          router.replace(`/admin/layers/${created.id}`);
        } else {
          const updated = await withToken((token) =>
            updateAdminLayer(token, layerId, input)
          );
          setLayer(updated);
          reset(toFormValues(updated));
          openSnackbar({ message: t("admin:form:saved"), type: "success" });
        }
      } catch (e) {
        const details =
          e instanceof AdminApiError && e.status === 422
            ? describeValidationError(e)
            : null;
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
    <Button startIcon={<ArrowBackIcon />} onClick={() => router.push("/admin/layers")}>
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

  if (!isNew && !layer) {
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
      <FormProvider {...form}>
        <form onSubmit={save} noValidate>
          <LayerForm />
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
        <Section title={t("admin:form:sections:raster")}>
          <RasterUploadSection layer={layer} onLayerChanged={reload} />
        </Section>
      )}
    </AdminPageContainer>
  );
};
