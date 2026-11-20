import {
  ADMIN_LANGUAGES,
  AdminCategory,
  AdminLanguage,
  AdminLayer,
  LayerAttributes,
  LayerInput,
  OPTIONAL_ATTRIBUTE_KEYS,
  StoredAttributes,
} from "@/interfaces/AdminLayer";

// The form's values: what the user types, converted to LayerInput on save.
export interface LayerFormValues {
  // Empty until the admin chooses one: a new layer has no default category
  category_id: string;
  pixel_size: string;
  baseline: string;
  compared_against: string;
  // useFieldArray needs objects, not plain strings
  references: { url: string }[];
  attributes: Record<AdminLanguage, Record<keyof LayerAttributes, string>>;
  considerations: Record<AdminLanguage, string>;
}

const emptyAttributes = (): Record<keyof LayerAttributes, string> => ({
  name: "",
  alias: "",
  coverage: "",
  source: "",
  resolution: "",
  contentDate: "",
  updateFrequency: "",
  publishDate: "",
});

export const toFormValues = (layer?: AdminLayer): LayerFormValues => {
  const attributes = {} as LayerFormValues["attributes"];
  const considerations = {} as LayerFormValues["considerations"];
  for (const language of ADMIN_LANGUAGES) {
    const stored: Partial<StoredAttributes> = layer?.attributes[language] ?? {};
    attributes[language] = emptyAttributes();
    for (const key of Object.keys(attributes[language]) as (keyof LayerAttributes)[]) {
      attributes[language][key] = stored[key] ?? "";
    }
    considerations[language] = layer?.considerations[language] ?? "";
  }
  return {
    category_id: layer?.category_id ?? "",
    pixel_size: layer ? String(layer.pixel_size) : "30",
    // New layers start at 2020, the baseline most layers use
    baseline: layer?.baseline != null ? String(layer.baseline) : "2020",
    compared_against:
      layer?.compared_against != null ? String(layer.compared_against) : "",
    references: (layer?.references ?? []).map((url) => ({ url })),
    attributes,
    considerations,
  };
};

/**
 * The layer to save. Years go only with a temporal category, as numbers, and as
 * `null` for any other: the API refuses years on a non-temporal category. The typed
 * years stay in the form, so choosing another category and back keeps them.
 */
export const toLayerInput = (
  values: LayerFormValues,
  category: Pick<AdminCategory, "temporal"> | null
): LayerInput => {
  const attributes = {} as LayerInput["attributes"];
  const considerations = {} as NonNullable<LayerInput["considerations"]>;
  for (const language of ADMIN_LANGUAGES) {
    const fields = values.attributes[language];
    attributes[language] = {
      name: fields.name.trim(),
      alias: fields.alias.trim(),
    };
    for (const key of OPTIONAL_ATTRIBUTE_KEYS) {
      const value = fields[key].trim();
      if (value) attributes[language][key] = value;
    }
    considerations[language] = values.considerations[language].trim() || null;
  }
  return {
    category_id: values.category_id,
    pixel_size: Number(values.pixel_size),
    baseline: category?.temporal ? Number(values.baseline) : null,
    compared_against: category?.temporal ? Number(values.compared_against) : null,
    references: values.references.map((r) => r.url.trim()).filter(Boolean),
    attributes,
    considerations,
  };
};

// Validation rules for react-hook-form, mirroring the API's. Each returns true or
// the translation key of the problem.
const isYear = (value: string) =>
  /^\d{4}$/.test(value.trim()) && Number(value) >= 1900 && Number(value) <= 2100;

/**
 * The categories a layer can be saved in: the enabled ones, and its current one
 * while disabled (the API lets an edit keep it). A category that doesn't resolve
 * is not in the API's list, so it can't be chosen.
 */
export const usableCategories = (
  categories: AdminCategory[],
  currentCategoryId: string | null
) =>
  categories.filter(
    (category) => category.enabled || category.id === currentCategoryId
  );

/** Whether the chosen category has a baseline and a comparison year. */
const isTemporal = (categories: AdminCategory[], categoryId: string) =>
  categories.find(({ id }) => id === categoryId)?.temporal ?? false;

/**
 * The rules that depend on the country's categories: the category itself, and the
 * years, which only count for a temporal category (they aren't shown otherwise).
 */
export const categoryValidators = (
  categories: AdminCategory[],
  currentCategoryId: string | null
) => ({
  category: (value: string) => {
    if (!value) return "admin:form:errors:category";
    return (
      usableCategories(categories, currentCategoryId).some(({ id }) => id === value) ||
      "admin:form:errors:categoryInvalid"
    );
  },
  baseline: (value: string, values: LayerFormValues) =>
    !isTemporal(categories, values.category_id) || validators.baseline(value, values),
  comparedAgainst: (value: string, values: LayerFormValues) =>
    !isTemporal(categories, values.category_id) || validators.year(value),
});

export const validators = {
  required: (value: string) => value.trim() !== "" || "admin:form:errors:required",
  pixelSize: (value: string) =>
    (value.trim() !== "" && Number(value) > 0) || "admin:form:errors:positive",
  year: (value: string) => isYear(value) || "admin:form:errors:year",
  baseline: (value: string, values: LayerFormValues) => {
    if (!isYear(value)) return "admin:form:errors:year";
    if (isYear(values.compared_against) && Number(value) > Number(values.compared_against)) {
      return "admin:form:errors:baselineAfterComparison";
    }
    return true;
  },
  reference: (value: string) =>
    !value.trim() ||
    /^https?:\/\//.test(value.trim()) ||
    "admin:form:errors:reference",
};
