"use client";

import React, { useContext, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Drawer,
  FormControlLabel,
  FormHelperText,
  IconButton,
  Radio,
  Switch,
  TextField,
  TextFieldProps,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import {
  Controller,
  FieldPathByValue,
  FormProvider,
  useController,
  useForm,
  useFormContext,
  useWatch,
  Validate,
} from "react-hook-form";
import {
  createAdminCategory,
  updateAdminCategory,
} from "@/api/adminCategories";
import { AdminApiError } from "@/api/adminLayers";
import {
  CATEGORY_ICON_NAMES,
  LayerCategoryIcon,
} from "@/components/reusable/LayerCategoryIcon";
import { Text } from "@/components/reusable/Text";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { ADMIN_LANGUAGES, AdminCategory } from "@/interfaces/AdminLayer";
import { localizedText } from "@/utils/localizedText";
import type { Polarity } from "@/utils/layerResults";
import { formatThreshold } from "@/utils/numbers";
import { apiRefusalReason } from "./adminErrors";
import { CategoryPreview } from "./CategoryPreview";
import {
  CATEGORY_COLOR_SWATCHES,
  CATEGORY_DESCRIPTION_MAX_LENGTH,
  CATEGORY_ID_MAX_LENGTH,
  CATEGORY_LABEL_MAX_LENGTH,
  CATEGORY_NAME_MAX_LENGTH,
  CategoryFormValues,
  categoryValidators,
  suggestCategoryId,
  takenCategoryIds,
  toCategoryCreate,
  toCategoryFormValues,
  toCategoryInput,
} from "./categoryFormState";
import { CategoryLocks, describeLock } from "./categoryRules";

const POLARITIES: Polarity[] = ["avoid", "required"];

type PanelTextFieldProps = Omit<TextFieldProps, "name" | "slotProps"> & {
  name: FieldPathByValue<CategoryFormValues, string>;
  validate?: Validate<string, CategoryFormValues>;
  // The API's limit, enforced while typing
  maxLength?: number;
  // Extra attributes of the <input> (e.g. min and max)
  htmlInput?: Record<string, unknown>;
};

/** An MUI TextField bound to the category form; errors are translation keys. */
const PanelTextField: React.FC<PanelTextFieldProps> = ({
  name,
  validate,
  maxLength,
  htmlInput,
  ...props
}) => {
  const { t } = useTranslation();
  const { control } = useFormContext<CategoryFormValues>();
  const {
    field,
    fieldState: { error },
  } = useController({ name, control, rules: { validate } });
  return (
    <TextField
      fullWidth
      size="small"
      {...props}
      name={field.name}
      value={field.value}
      onChange={(event) => {
        field.onChange(event);
        props.onChange?.(event);
      }}
      onBlur={field.onBlur}
      inputRef={field.ref}
      error={!!error}
      helperText={error?.message ? t(error.message) : props.helperText}
      slotProps={{ htmlInput: { ...htmlInput, maxLength } }}
    />
  );
};

/** A label and its fields, as the mockup's drawer groups them. */
const Field: React.FC<{ label: string; help?: string; children: React.ReactNode }> = ({
  label,
  help,
  children,
}) => (
  <Box component="fieldset" sx={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
    <Text component="legend" variant="body2" bold sx={{ marginBottom: 1, padding: 0 }}>
      {label}
    </Text>
    {children}
    {help && (
      <Text variant="caption" color="secondary" component="p" sx={{ marginTop: 0.75 }}>
        {help}
      </Text>
    )}
  </Box>
);

/** Two fields side by side (ES and EN), stacked on a phone. */
const Pair: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
      gap: 1.5,
    }}
  >
    {children}
  </Box>
);

interface FormProps {
  category: AdminCategory | null;
  categories: AdminCategory[];
  locks: CategoryLocks;
  globalThreshold: number;
  onClose: () => void;
  onSaved: (category: AdminCategory, created: boolean) => void;
}

const CategoryForm: React.FC<FormProps> = ({
  category,
  categories,
  locks,
  globalThreshold,
  onClose,
  onSaved,
}) => {
  const { t, i18n } = useTranslation();
  const { withToken } = useContext(AdminSessionContext);
  const { openSnackbar } = useContext(SnackbarContext);
  const isNew = category === null;
  const form = useForm<CategoryFormValues>({
    defaultValues: toCategoryFormValues(category ?? undefined),
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { control, handleSubmit, setValue, setError, formState } = form;
  const values = useWatch({ control }) as CategoryFormValues;
  const [refusal, setRefusal] = useState<string | null>(null);

  // While creating, the id follows the Spanish name until the admin edits it.
  const [idEdited, setIdEdited] = useState(false);
  const nameEs = values.name.es;
  useEffect(() => {
    if (!isNew || idEdited) return;
    setValue("id", suggestCategoryId(nameEs), {
      shouldValidate: formState.isSubmitted,
    });
  }, [isNew, idEdited, nameEs, setValue, formState.isSubmitted]);

  const taken = takenCategoryIds(categories);
  const thresholdText = formatThreshold(globalThreshold, i18n.language);

  const save = handleSubmit(
    async (submitted) => {
      setRefusal(null);
      try {
        const saved = isNew
          ? await withToken((token) => createAdminCategory(token, toCategoryCreate(submitted)))
          : await withToken((token) =>
              updateAdminCategory(token, category.id, toCategoryInput(submitted))
            );
        openSnackbar({
          message: isNew
            ? t("admin:categories:form:created", {
                name: localizedText(saved.name, i18n.language),
              })
            : t("admin:categories:form:saved"),
          type: "success",
        });
        onSaved(saved, isNew);
      } catch (e) {
        const reason = apiRefusalReason(e);
        // A 409 on create is almost always an id held by an entry the list doesn't
        // show (a rejected one); the API's reason below covers the other case (the
        // categories file stopped being readable).
        if (isNew && e instanceof AdminApiError && e.status === 409) {
          setError("id", { message: "admin:categories:form:errors:idTaken" });
        }
        setRefusal(
          reason
            ? `${t("admin:categories:form:saveError")} ${t("admin:layers:refused", { detail: reason })}`
            : t("admin:categories:form:saveError")
        );
      }
    },
    () => setRefusal(t("admin:categories:form:errors:invalid"))
  );

  const publishedNote = !isNew && category.publishedLayerCount > 0;

  return (
    <FormProvider {...form}>
      <Box
        component="form"
        onSubmit={save}
        noValidate
        sx={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            paddingX: 3,
            paddingY: 2,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Text variant="h6" component="h2" bold>
            {isNew
              ? t("admin:categories:form:createTitle")
              : t("admin:categories:form:editTitle")}
          </Text>
          <IconButton
            aria-label={t("admin:categories:form:close")}
            onClick={onClose}
            sx={{ marginLeft: "auto" }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box
          sx={{
            flex: 1,
            overflow: "auto",
            paddingX: 3,
            paddingY: 2.5,
            display: "flex",
            flexDirection: "column",
            gap: 2.5,
          }}
        >
          <Field label={t("admin:categories:form:name")}>
            <Pair>
              {ADMIN_LANGUAGES.map((language) => (
                <PanelTextField
                  key={language}
                  name={`name.${language}`}
                  label={t(`admin:categories:form:languages:${language}`)}
                  required
                  maxLength={CATEGORY_NAME_MAX_LENGTH}
                  validate={categoryValidators.required}
                />
              ))}
            </Pair>
          </Field>

          {isNew ? (
            <PanelTextField
              name="id"
              label={t("admin:categories:form:id")}
              required
              maxLength={CATEGORY_ID_MAX_LENGTH}
              validate={categoryValidators.id(taken)}
              helperText={t("admin:categories:form:idHelp")}
              onChange={() => setIdEdited(true)}
            />
          ) : (
            <Text variant="body2" color="secondary">
              {t("admin:categories:form:idReadOnly", { id: category.id })}
            </Text>
          )}

          <Field
            label={t("admin:categories:form:description")}
            help={t("admin:categories:form:descriptionHelp")}
          >
            <Pair>
              {ADMIN_LANGUAGES.map((language) => (
                <PanelTextField
                  key={language}
                  name={`description.${language}`}
                  label={t(`admin:categories:form:languages:${language}`)}
                  multiline
                  minRows={2}
                  maxLength={CATEGORY_DESCRIPTION_MAX_LENGTH}
                />
              ))}
            </Pair>
          </Field>

          <Field label={t("admin:categories:form:iconAndColor")}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Controller
                control={control}
                name="icon"
                render={({ field }) => (
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    aria-label={t("admin:categories:form:icon")}
                    value={field.value}
                    onChange={(_, icon) => icon && field.onChange(icon)}
                    sx={{ flexWrap: "wrap" }}
                  >
                    {CATEGORY_ICON_NAMES.map((icon) => (
                      <ToggleButton
                        key={icon}
                        value={icon}
                        aria-label={t(`admin:categories:form:icons:${icon}`)}
                      >
                        <LayerCategoryIcon icon={icon} />
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                )}
              />
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                {CATEGORY_COLOR_SWATCHES.map((swatch) => {
                  const selected = values.color.toLowerCase() === swatch;
                  return (
                    <Tooltip key={swatch} title={swatch}>
                      <IconButton
                        aria-label={t("admin:categories:form:swatch", { color: swatch })}
                        aria-pressed={selected}
                        onClick={() =>
                          setValue("color", swatch, {
                            shouldValidate: formState.isSubmitted,
                            shouldDirty: true,
                          })
                        }
                        sx={{
                          width: 32,
                          height: 32,
                          backgroundColor: swatch,
                          color: "common.white",
                          outline: selected ? "2px solid" : "none",
                          outlineColor: "text.primary",
                          outlineOffset: 2,
                          "&:hover": { backgroundColor: swatch, opacity: 0.85 },
                        }}
                      >
                        {selected && <CheckIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </Tooltip>
                  );
                })}
                <PanelTextField
                  name="color"
                  label={t("admin:categories:form:customColor")}
                  placeholder="#rrggbb"
                  maxLength={7}
                  validate={categoryValidators.color}
                  sx={{ width: 140 }}
                  fullWidth={false}
                />
              </Box>
            </Box>
          </Field>

          <Controller
            control={control}
            name="polarity"
            rules={{ validate: categoryValidators.polarity }}
            render={({ field, fieldState: { error } }) => (
              <Field label={t("admin:categories:form:polarity")}>
                <Box
                  role="radiogroup"
                  aria-label={t("admin:categories:form:polarity")}
                  sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                >
                  {POLARITIES.map((polarity) => {
                    const checked = field.value === polarity;
                    return (
                      <Box
                        key={polarity}
                        component="label"
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 1,
                          padding: 1.5,
                          border: 1,
                          borderRadius: 2,
                          borderColor: checked
                            ? "primary.main"
                            : error
                              ? "error.main"
                              : "divider",
                          backgroundColor: checked ? "#F3FAFD" : "transparent",
                          cursor: locks.polarity ? "default" : "pointer",
                          opacity: locks.polarity && !checked ? 0.6 : 1,
                        }}
                      >
                        <Radio
                          checked={checked}
                          onChange={() => field.onChange(polarity)}
                          disabled={!!locks.polarity}
                          value={polarity}
                          name={field.name}
                          inputRef={polarity === "avoid" ? field.ref : undefined}
                          sx={{ padding: 0.25 }}
                        />
                        <Box>
                          <Text variant="body2" bold>
                            {t(`admin:categories:form:polarityOptions:${polarity}:title`)}
                          </Text>
                          <Text variant="body2" color="secondary">
                            {t(`admin:categories:form:polarityOptions:${polarity}:help`)}
                          </Text>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
                {error?.message && (
                  <FormHelperText error>{t(error.message)}</FormHelperText>
                )}
                {locks.polarity && (
                  <FormHelperText>{describeLock(locks.polarity, "polarity", t)}</FormHelperText>
                )}
              </Field>
            )}
          />

          <Controller
            control={control}
            name="temporal"
            render={({ field }) => (
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      disabled={!!locks.temporal}
                    />
                  }
                  label={t("admin:categories:form:temporal")}
                />
                <FormHelperText>
                  {locks.temporal
                    ? describeLock(locks.temporal, "temporal", t)
                    : t("admin:categories:form:temporalHelp")}
                </FormHelperText>
              </Box>
            )}
          />

          <Field
            label={t("admin:categories:form:threshold")}
            help={t("admin:categories:form:thresholdHelp")}
          >
            <Controller
              control={control}
              name="useGlobalThreshold"
              rules={{ deps: ["threshold"] }}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                    />
                  }
                  label={t("admin:categories:form:useGlobalThreshold", {
                    threshold: thresholdText,
                  })}
                />
              )}
            />
            {!values.useGlobalThreshold && (
              <PanelTextField
                name="threshold"
                label={t("admin:categories:form:ownThreshold")}
                type="number"
                required
                validate={categoryValidators.threshold}
                sx={{ maxWidth: 240 }}
                htmlInput={{ min: 0, max: 100, step: "any" }}
              />
            )}
          </Field>

          <Field label={t("admin:categories:form:resultLabels")}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {(["ok", "flagged"] as const).map((kind) => (
                <Box key={kind}>
                  <Text variant="caption" color="secondary" component="p" sx={{ marginBottom: 0.75 }}>
                    {t(`admin:categories:form:${kind}`)}
                  </Text>
                  <Pair>
                    {ADMIN_LANGUAGES.map((language) => (
                      <PanelTextField
                        key={language}
                        name={`resultLabels.${kind}.${language}`}
                        label={`${t(`admin:categories:form:${kind}`)} · ${t(`admin:categories:form:languages:${language}`)}`}
                        required
                        maxLength={CATEGORY_LABEL_MAX_LENGTH}
                        validate={categoryValidators.required}
                      />
                    ))}
                  </Pair>
                </Box>
              ))}
            </Box>
          </Field>

          <CategoryPreview values={values} globalThreshold={globalThreshold} />

          {publishedNote && <Alert severity="info">{t("admin:categories:form:publishedNote")}</Alert>}
          {refusal && <Alert severity="error">{refusal}</Alert>}
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 1,
            paddingX: 3,
            paddingY: 1.5,
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <Button onClick={onClose}>{t("admin:categories:form:cancel")}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={formState.isSubmitting}
          >
            {formState.isSubmitting
              ? t("admin:categories:form:saving")
              : isNew
                ? t("admin:categories:form:create")
                : t("admin:categories:form:save")}
          </Button>
        </Box>
      </Box>
    </FormProvider>
  );
};

interface Props extends FormProps {
  open: boolean;
}

/** The right-hand panel that creates or edits a category (mockup v2, "Nueva categoría"). */
export const CategoryPanel: React.FC<Props> = ({ open, ...props }) => (
  <Drawer
    anchor="right"
    open={open}
    onClose={props.onClose}
    slotProps={{ paper: { sx: { width: { xs: "100%", sm: 520 } } } }}
  >
    {/* Remounted per category, so each opening starts from the stored values. */}
    {open && <CategoryForm key={props.category?.id ?? "new"} {...props} />}
  </Drawer>
);
