"use client";

import React, { useMemo } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Grid,
  IconButton,
  Paper,
  TextField,
  TextFieldProps,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";
import {
  Controller,
  FieldPath,
  FieldPathByValue,
  useController,
  useFieldArray,
  useFormContext,
  useWatch,
  Validate,
} from "react-hook-form";
import { ClassicTabs } from "@/components/reusable/ClassicTabs";
import { Text } from "@/components/reusable/Text";
import { countries } from "@/utils/countries";
import {
  ADMIN_LANGUAGES,
  AdminLanguage,
  LayerAttributes,
  OPTIONAL_ATTRIBUTE_KEYS,
} from "@/interfaces/AdminLayer";
import { LayerFormValues, validators } from "./layerFormState";

export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <Paper sx={{ padding: 3, marginBottom: 3 }}>
    <Text variant="h6" component="h2" bold sx={{ marginBottom: 2 }}>
      {title}
    </Text>
    {children}
  </Paper>
);

type FormTextFieldProps = Omit<TextFieldProps, "name"> & {
  // Only fields whose value is text
  name: FieldPathByValue<LayerFormValues, string>;
  validate?: Validate<string, LayerFormValues>;
  // Fields to re-validate when this one changes (e.g. the baseline year)
  deps?: FieldPath<LayerFormValues>[];
};

/** An MUI TextField bound to the layer form; errors are translation keys. */
const FormTextField: React.FC<FormTextFieldProps> = ({
  name,
  validate,
  deps,
  ...props
}) => {
  const { t } = useTranslation();
  const { control } = useFormContext<LayerFormValues>();
  const {
    field,
    fieldState: { error },
  } = useController({ name, control, rules: { validate, deps } });
  return (
    <TextField
      fullWidth
      size="small"
      {...props}
      name={field.name}
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      inputRef={field.ref}
      error={!!error}
      helperText={error?.message ? t(error.message) : props.helperText}
    />
  );
};

const LanguageFields: React.FC<{ language: AdminLanguage }> = ({ language }) => {
  const { t } = useTranslation();
  const considerations = useWatch<LayerFormValues, `considerations.${AdminLanguage}`>({
    name: `considerations.${language}`,
  });
  const keys: (keyof LayerAttributes)[] = ["name", "alias", ...OPTIONAL_ATTRIBUTE_KEYS];

  return (
    <Grid container spacing={2} sx={{ paddingTop: 2 }}>
      {keys.map((key) => {
        const required = key === "name" || key === "alias";
        return (
          <Grid key={key} size={{ xs: 12, md: key === "name" ? 8 : key === "alias" ? 4 : 6 }}>
            <FormTextField
              name={`attributes.${language}.${key}`}
              label={t(`admin:form:attributes:${key}`)}
              required={required}
              validate={required ? validators.required : undefined}
            />
          </Grid>
        );
      })}
      <Grid size={{ xs: 12, md: 6 }}>
        <FormTextField
          name={`considerations.${language}`}
          label={t("admin:form:considerations")}
          multiline
          minRows={10}
          size="medium"
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Text color="secondary" variant="body2" sx={{ marginBottom: 1 }}>
          {t("admin:form:preview")}
        </Text>
        <Box
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            padding: 2,
            minHeight: 240,
            maxHeight: 480,
            overflow: "auto",
            typography: "body2",
          }}
        >
          {considerations?.trim() ? (
            // react-markdown doesn't render raw HTML, so this is safe to preview.
            <ReactMarkdown>{considerations}</ReactMarkdown>
          ) : (
            <Text color="secondary" variant="body2">
              {t("admin:form:emptyPreview")}
            </Text>
          )}
        </Box>
      </Grid>
    </Grid>
  );
};

export const LayerForm: React.FC = () => {
  const { t, i18n } = useTranslation();
  const uiLanguage = i18n.language === "en" ? "en" : "es";
  const {
    control,
    formState: { errors },
  } = useFormContext<LayerFormValues>();
  const references = useFieldArray({ control, name: "references" });

  const countryOptions = useMemo(
    () =>
      countries
        .map((c) => ({
          code: c.code,
          label: `${uiLanguage === "en" ? c.nameEn : c.nameEs} (${c.code})`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, uiLanguage)),
    [uiLanguage]
  );

  return (
    <>
      <Section title={t("admin:form:sections:layer")}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormTextField
              name="pixel_size"
              label={t("admin:form:pixelSize")}
              type="number"
              required
              validate={validators.pixelSize}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <FormTextField
              name="baseline"
              label={t("admin:form:baseline")}
              type="number"
              required
              validate={validators.baseline}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <FormTextField
              name="compared_against"
              label={t("admin:form:comparedAgainst")}
              type="number"
              required
              validate={validators.year}
              deps={["baseline"]}
            />
          </Grid>
          <Grid size={12}>
            <Controller
              name="available_countries_codes"
              control={control}
              rules={{ validate: validators.countries }}
              render={({ field, fieldState: { error } }) => (
                <Autocomplete
                  multiple
                  options={countryOptions}
                  value={countryOptions.filter((o) => field.value.includes(o.code))}
                  onChange={(_, selected) => field.onChange(selected.map((o) => o.code))}
                  onBlur={field.onBlur}
                  isOptionEqualToValue={(option, value) => option.code === value.code}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      inputRef={field.ref}
                      label={t("admin:form:countries")}
                      required
                      error={!!error}
                      helperText={error?.message && t(error.message)}
                      size="small"
                    />
                  )}
                />
              )}
            />
          </Grid>
          <Grid size={12}>
            <Text color="secondary" variant="body2" sx={{ marginBottom: 1 }}>
              {t("admin:form:references")}
            </Text>
            {references.fields.map((reference, index) => (
              <Box key={reference.id} sx={{ display: "flex", gap: 1, marginBottom: 1 }}>
                <FormTextField
                  name={`references.${index}.url`}
                  placeholder="https://"
                  validate={validators.reference}
                />
                <IconButton
                  aria-label={t("admin:form:removeReference")}
                  onClick={() => references.remove(index)}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
            <Button startIcon={<AddIcon />} onClick={() => references.append({ url: "" })}>
              {t("admin:form:addReference")}
            </Button>
          </Grid>
        </Grid>
      </Section>

      <Section title={t("admin:form:sections:texts")}>
        <ClassicTabs
          keepMounted
          tabs={ADMIN_LANGUAGES.map((language, index) => {
            const incomplete = !!errors.attributes?.[language];
            return {
              id: index,
              title: (
                <Text
                  variant="body2"
                  bold
                  sx={incomplete ? { color: "error.main" } : undefined}
                >
                  {t(`admin:form:languages:${language}`)}
                  {incomplete ? " *" : ""}
                </Text>
              ),
              content: <LanguageFields language={language} />,
            };
          })}
        />
      </Section>
    </>
  );
};
