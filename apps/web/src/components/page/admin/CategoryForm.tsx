"use client";

import React, { useContext, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  FormLabel,
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
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import TextFieldsOutlinedIcon from "@mui/icons-material/TextFieldsOutlined";
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
import {
  CATEGORY_ICON_NAMES,
  LayerCategoryIcon,
} from "@/components/reusable/LayerCategoryIcon";
import { FlowSection } from "@/components/page/flow/FlowSection";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { Text } from "@/components/reusable/Text";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { ADMIN_LANGUAGES, AdminCategory } from "@/interfaces/AdminLayer";
import { AS_TEXT } from "@/utils/asText";
import { localizedText } from "@/utils/localizedText";
import type { Polarity } from "@/utils/layerResults";
import { formatThreshold } from "@/utils/numbers";
import { apiRefusalReason } from "./adminErrors";
import { CategoryPreview } from "./CategoryPreview";
import {
  CATEGORY_COLOR_SWATCHES,
  CATEGORY_DESCRIPTION_MAX_LENGTH,
  CATEGORY_LABEL_MAX_LENGTH,
  CATEGORY_NAME_MAX_LENGTH,
  CategoryFormValues,
  categoryValidators,
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
  // Shown inside the field, before the value
  startAdornment?: React.ReactNode;
};

/** An MUI TextField bound to the category form; errors are translation keys. */
const PanelTextField: React.FC<PanelTextFieldProps> = ({
  name,
  validate,
  maxLength,
  htmlInput,
  startAdornment,
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
      slotProps={{ htmlInput: { ...htmlInput, maxLength }, input: { startAdornment } }}
    />
  );
};

/** A label and its fields, as the mockup's editor groups them. */
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

/** The color swatches: re-rendered when the color changes, not on every keystroke. */
// The icons as a grid of separate tiles, not a joined button bar.
const ICON_GRID = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, 44px)",
  gap: 0.75,
  "& .MuiToggleButtonGroup-grouped.MuiToggleButtonGroup-grouped": {
    width: 44,
    height: 44,
    margin: 0,
    borderRadius: "10px",
    border: `1px solid ${FLOW_COLORS.line}`,
    color: FLOW_COLORS.ink2,
    "&.Mui-selected": {
      borderColor: FLOW_COLORS.blue,
      backgroundColor: FLOW_COLORS.blue50,
      color: FLOW_COLORS.blue,
    },
  },
} as const;

/** A small square of the typed color, empty while it isn't a valid hex. */
const ColorSample: React.FC = () => {
  const { control } = useFormContext<CategoryFormValues>();
  const color = useWatch({ control, name: "color" }).trim();
  const valid = categoryValidators.color(color) === true;
  return (
    <Box
      aria-hidden
      sx={{
        width: 16,
        height: 16,
        flexShrink: 0,
        marginRight: 1,
        borderRadius: "4px",
        backgroundColor: valid ? color : "transparent",
        border: valid ? "none" : `1px dashed ${FLOW_COLORS.muted}`,
      }}
    />
  );
};

const ColorSwatches: React.FC = () => {
  const { t } = useTranslation();
  const { control, setValue, formState } = useFormContext<CategoryFormValues>();
  const color = useWatch({ control, name: "color" });
  return (
    <>
      {CATEGORY_COLOR_SWATCHES.map((swatch) => {
        const selected = color.toLowerCase() === swatch;
        return (
          <Tooltip key={swatch} title={swatch}>
            <IconButton
              aria-label={t("admin:categories:form:swatch", { color: swatch, ...AS_TEXT })}
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
    </>
  );
};

/** The category's own threshold, asked for only when it doesn't use the global one. */
const OwnThreshold: React.FC = () => {
  const { t } = useTranslation();
  const { control } = useFormContext<CategoryFormValues>();
  const useGlobalThreshold = useWatch({ control, name: "useGlobalThreshold" });
  if (useGlobalThreshold) return null;
  return (
    <PanelTextField
      name="threshold"
      label={t("admin:categories:form:ownThreshold")}
      type="number"
      required
      validate={categoryValidators.threshold}
      sx={{ maxWidth: 240 }}
      htmlInput={{ min: 0, max: 100, step: "any" }}
    />
  );
};

/** The preview, the only part that follows every field as it is typed. */
const LivePreview: React.FC<{ globalThreshold: number }> = ({ globalThreshold }) => {
  const { control } = useFormContext<CategoryFormValues>();
  const values = useWatch({ control }) as CategoryFormValues;
  return <CategoryPreview values={values} globalThreshold={globalThreshold} />;
};

export interface CategoryFormProps {
  category: AdminCategory | null;
  locks: CategoryLocks;
  globalThreshold: number;
  onCancel: () => void;
  onSaved: (category: AdminCategory, created: boolean) => void;
}

/**
 * The category's editor (mockup v2, "Nueva categoría"): its fields in cards, and
 * the preview beside them from 900 px.
 */
export const CategoryForm: React.FC<CategoryFormProps> = ({
  category,
  locks,
  globalThreshold,
  onCancel,
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
  const { control, handleSubmit, formState } = form;
  const [refusal, setRefusal] = useState<string | null>(null);

  const thresholdText = formatThreshold(globalThreshold, i18n.language);

  const save = handleSubmit(
    async (submitted) => {
      setRefusal(null);
      try {
        const saved = isNew
          ? await withToken((token) => createAdminCategory(token, toCategoryInput(submitted)))
          : await withToken((token) =>
              updateAdminCategory(token, category.id, toCategoryInput(submitted))
            );
        openSnackbar({
          message: isNew
            ? t("admin:categories:form:created", {
                name: localizedText(saved.name, i18n.language),
                ...AS_TEXT,
              })
            : t("admin:categories:form:saved"),
          type: "success",
        });
        onSaved(saved, isNew);
      } catch (e) {
        const reason = apiRefusalReason(e);
        setRefusal(
          reason
            ? `${t("admin:categories:form:saveError")} ${t("admin:layers:refused", { detail: reason, ...AS_TEXT })}`
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
        aria-label={
          isNew ? t("admin:categories:form:createTitle") : t("admin:categories:form:editTitle")
        }
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 340px" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, minWidth: 0 }}>
          <FlowSection
            title={t("admin:categories:form:sections:identity")}
            icon={<LabelOutlinedIcon fontSize="small" />}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
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

              <Text variant="body2" color="secondary">
                {isNew
                  ? t("admin:categories:form:idGenerated")
                  : t("admin:categories:form:idReadOnly", { id: category.id, ...AS_TEXT })}
              </Text>

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
            </Box>
          </FlowSection>

          <FlowSection
            title={t("admin:categories:form:iconAndColor")}
            icon={<PaletteOutlinedIcon fontSize="small" />}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <Field label={t("admin:categories:form:icon")}>
                <Controller
                  control={control}
                  name="icon"
                  render={({ field }) => (
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={field.value}
                      onChange={(_, icon) => icon && field.onChange(icon)}
                      sx={ICON_GRID}
                    >
                      {CATEGORY_ICON_NAMES.map((icon) => (
                        <ToggleButton
                          key={icon}
                          value={icon}
                          aria-label={t(`admin:categories:form:icons:${icon}`)}
                          title={t(`admin:categories:form:icons:${icon}`)}
                        >
                          <LayerCategoryIcon icon={icon} />
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  )}
                />
              </Field>
              <Field label={t("admin:categories:form:color")}>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <ColorSwatches />
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, marginTop: 1.5 }}>
                  <FormLabel htmlFor="category-color" sx={{ fontSize: 14, flexShrink: 0 }}>
                    {t("admin:categories:form:customColor")}
                  </FormLabel>
                  <PanelTextField
                    id="category-color"
                    name="color"
                    placeholder="#rrggbb"
                    maxLength={7}
                    validate={categoryValidators.color}
                    startAdornment={<ColorSample />}
                    sx={{ width: 150 }}
                    fullWidth={false}
                  />
                </Box>
              </Field>
            </Box>
          </FlowSection>

          <FlowSection
            title={t("admin:categories:form:sections:rule")}
            icon={<RuleOutlinedIcon fontSize="small" />}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <Controller
                control={control}
                name="polarity"
                rules={{ validate: categoryValidators.polarity }}
                render={({ field, fieldState: { error } }) => (
                  <Field label={t("admin:categories:form:polarity")}>
                    <Box
                      role="radiogroup"
                      aria-label={t("admin:categories:form:polarity")}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                        gap: 1,
                      }}
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
                              borderRadius: "10px",
                              borderColor: checked
                                ? FLOW_COLORS.blue
                                : error
                                  ? "error.main"
                                  : FLOW_COLORS.line,
                              backgroundColor: checked ? FLOW_COLORS.blue25 : "transparent",
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
                        ...AS_TEXT,
                      })}
                    />
                  )}
                />
                <OwnThreshold />
              </Field>
            </Box>
          </FlowSection>

          <FlowSection
            title={t("admin:categories:form:resultLabels")}
            icon={<TextFieldsOutlinedIcon fontSize="small" />}
          >
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
          </FlowSection>

          {publishedNote && <Alert severity="info">{t("admin:categories:form:publishedNote")}</Alert>}
          {refusal && <Alert severity="error">{refusal}</Alert>}

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button onClick={onCancel}>{t("admin:categories:form:cancel")}</Button>
            <Button type="submit" variant="contained" disabled={formState.isSubmitting}>
              {formState.isSubmitting
                ? t("admin:categories:form:saving")
                : isNew
                  ? t("admin:categories:form:create")
                  : t("admin:categories:form:save")}
            </Button>
          </Box>
        </Box>

        {/* Beside the form on a wide screen, in view while the form scrolls */}
        <Box sx={{ position: { md: "sticky" }, top: { md: 88 } }}>
          <LivePreview globalThreshold={globalThreshold} />
        </Box>
      </Box>
    </FormProvider>
  );
};
