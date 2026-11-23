"use client";

import React, { useState } from "react";
import {
  Box,
  Button,
  Grid,
  IconButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  TextField,
  TextFieldProps,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";
import {
  FieldPath,
  FieldPathByValue,
  useController,
  useFieldArray,
  useFormContext,
  useWatch,
  Validate,
} from "react-hook-form";
import { FlowSection } from "@/components/page/flow/FlowSection";
import { ClassicTabs } from "@/components/reusable/ClassicTabs";
import { LayerCategoryIcon } from "@/components/reusable/LayerCategoryIcon";
import { Text } from "@/components/reusable/Text";
import {
  ADMIN_LANGUAGES,
  AdminCategory,
  AdminLanguage,
  AdminLayer,
  LayerAttributes,
  OPTIONAL_ATTRIBUTE_KEYS,
} from "@/interfaces/AdminLayer";
import { categoryTints } from "@/utils/categoryColors";
import { AS_TEXT } from "@/utils/asText";
import { localizedText } from "@/utils/localizedText";
import {
  categoryValidators,
  LayerFormValues,
  usableCategories,
  validators,
} from "./layerFormState";
import { LayerTextsExampleModal } from "./LayerTextsExampleModal";
import enAdmin from "@/locales/en/admin.json";
import esAdmin from "@/locales/es/admin.json";

// Each language tab labels its fields in its own language, whatever the page's.
const TAB_LABELS: Record<AdminLanguage, typeof enAdmin.form> = {
  en: enAdmin.form,
  es: esAdmin.form,
};

export const Section: React.FC<{
  title: string;
  /** In the heading's tile, as the stage pages' cards. */
  icon: React.ReactNode;
  // At the heading's right (e.g. a help button)
  titleAction?: React.ReactNode;
  // An anchor to scroll to
  id?: string;
  children: React.ReactNode;
}> = ({ title, icon, titleAction, id, children }) => (
  // The scroll margin keeps the title clear of the fixed header.
  <Box id={id} sx={{ scrollMarginTop: 88 }}>
    <FlowSection title={title} icon={icon} action={titleAction}>
      {children}
    </FlowSection>
  </Box>
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
  const labels = TAB_LABELS[language];
  const considerations = useWatch<LayerFormValues, `considerations.${AdminLanguage}`>({
    name: `considerations.${language}`,
  });
  const keys: (keyof LayerAttributes)[] = ["name", "alias", ...OPTIONAL_ATTRIBUTE_KEYS];

  return (
    <Grid container spacing={2} sx={{ paddingTop: 2 }}>
      {keys.map((key) => {
        const required = key === "name" || key === "alias";
        return (
          <Grid key={key} size={{ xs: 12, md: 6 }}>
            <FormTextField
              name={`attributes.${language}.${key}`}
              label={labels.attributes[key]}
              required={required}
              validate={required ? validators.required : undefined}
            />
          </Grid>
        );
      })}
      <Grid size={{ xs: 12, md: 6 }}>
        <FormTextField
          name={`considerations.${language}`}
          label={labels.considerations}
          multiline
          minRows={10}
          maxRows={20}
          size="medium"
          // Always on the border: a tall box whose label moves reads oddly.
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        {/* Outlined like the field beside it, and as tall: the field sets the
            row's height and the preview scrolls within it. */}
        <Box sx={{ position: "relative", height: "100%", minHeight: { xs: 240, md: 0 } }}>
          <Box
            component="fieldset"
            aria-hidden
            sx={{
              position: "absolute",
              inset: "-5px 0 0 0",
              margin: 0,
              padding: "0 8px",
              border: 1,
              // MUI's outlined input border, which isn't a palette color.
              borderColor: "rgba(0, 0, 0, 0.23)",
              borderRadius: 1,
              pointerEvents: "none",
            }}
          >
            <Box
              component="legend"
              sx={{
                typography: "caption",
                lineHeight: "11px",
                color: "text.secondary",
                padding: "0 5px",
              }}
            >
              {labels.preview}
            </Box>
          </Box>
          <Box
            role="region"
            aria-label={labels.preview}
            sx={{
              position: "absolute",
              inset: 0,
              padding: "16.5px 14px",
              overflow: "auto",
              typography: "body2",
            }}
          >
            {considerations?.trim() ? (
              // react-markdown doesn't render raw HTML, so this is safe to preview.
              <ReactMarkdown>{considerations}</ReactMarkdown>
            ) : (
              <Text color="secondary" variant="body2">
                {labels.emptyPreview}
              </Text>
            )}
          </Box>
        </Box>
      </Grid>
    </Grid>
  );
};

interface LayerFormProps {
  /** The country's categories (enabled or not); empty until they load. */
  categories: AdminCategory[];
  /** The layer being edited; null for a new one. */
  layer: AdminLayer | null;
}

export const LayerForm: React.FC<LayerFormProps> = ({ categories, layer }) => {
  const { t, i18n } = useTranslation();
  const {
    control,
    formState: { errors },
  } = useFormContext<LayerFormValues>();
  const references = useFieldArray({ control, name: "references" });
  const [exampleOpen, setExampleOpen] = useState(false);
  const categoryId = useWatch<LayerFormValues, "category_id">({ name: "category_id" });

  const currentCategoryId = layer?.category_id ?? null;
  const options = usableCategories(categories, currentCategoryId);
  const rules = categoryValidators(categories, currentCategoryId);
  const selected = categories.find(({ id }) => id === categoryId) ?? null;
  // A layer whose category doesn't resolve keeps showing it, so the form says the truth;
  // the validator asks for a valid one (the API refuses it).
  const broken =
    layer?.category_issue && categoryId === layer.category_id ? layer : null;
  // A published layer can't change category (the API answers 400).
  const categoryLocked = !!layer?.enabled;

  return (
    <>
      <Section
        title={t("admin:form:sections:layer")}
        icon={<LayersOutlinedIcon fontSize="small" />}
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <FormTextField
              name="category_id"
              label={t("admin:form:category")}
              select
              required
              disabled={categoryLocked}
              validate={rules.category}
              helperText={
                categoryLocked ? t("admin:form:categoryLocked") : t("admin:form:categoryHelp")
              }
            >
              {broken && (
                <MenuItem value={broken.category_id}>
                  {t(`admin:layers:categoryIssue:${broken.category_issue}`, {
                    category: broken.category_id,
                    ...AS_TEXT,
                  })}
                </MenuItem>
              )}
              {options.map((category) => {
                const name = localizedText(category.name, i18n.language);
                return (
                  <MenuItem key={category.id} value={category.id}>
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <ListItemIcon
                        sx={{ minWidth: 32, color: categoryTints(category.color).color }}
                      >
                        <LayerCategoryIcon icon={category.icon} fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>
                        {category.enabled
                          ? name
                          : t("admin:form:categoryDisabledOption", { name, ...AS_TEXT })}
                      </ListItemText>
                    </Box>
                  </MenuItem>
                );
              })}
            </FormTextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormTextField
              name="pixel_size"
              label={t("admin:form:pixelSize")}
              type="number"
              required
              validate={validators.pixelSize}
            />
          </Grid>
          {selected?.temporal && (
            <>
              <Grid size={{ xs: 6, md: 4 }}>
                <FormTextField
                  name="baseline"
                  label={t("admin:form:baseline")}
                  type="number"
                  required
                  validate={rules.baseline}
                />
              </Grid>
              <Grid size={{ xs: 6, md: 4 }}>
                <FormTextField
                  name="compared_against"
                  label={t("admin:form:comparedAgainst")}
                  type="number"
                  required
                  validate={rules.comparedAgainst}
                  deps={["baseline"]}
                />
              </Grid>
            </>
          )}
          {selected && !selected.temporal && (
            <Grid size={12}>
              <Text color="secondary" variant="body2">
                {t("admin:form:noYears")}
              </Text>
            </Grid>
          )}
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

      <Section
        title={t("admin:form:sections:texts")}
        icon={<TranslateOutlinedIcon fontSize="small" />}
        titleAction={
          <IconButton
            aria-label={t("admin:form:example:open")}
            onClick={() => setExampleOpen(true)}
          >
            <InfoOutlined />
          </IconButton>
        }
      >
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
      <LayerTextsExampleModal open={exampleOpen} onClose={() => setExampleOpen(false)} />
    </>
  );
};
