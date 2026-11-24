import { AdminCategory, AdminLanguage, CategoryInput } from "@/interfaces/AdminLayer";
import type { LayerCategoryIcon } from "@/interfaces/LayerCategory";
import type { Polarity } from "@/utils/layerResults";

// The category panel's values: what the admin types, converted to CategoryInput
// on save. The limits mirror the API's (`app/modules/layers/categories.py`).

export const CATEGORY_NAME_MAX_LENGTH = 100;
export const CATEGORY_DESCRIPTION_MAX_LENGTH = 1000;
export const CATEGORY_LABEL_MAX_LENGTH = 60;
// A category's id, as the API makes it from the Spanish name (`new_category_id`).
export const CATEGORY_ID_PATTERN = /^[a-z][a-z0-9_]{0,49}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

// The default "Deforestación" red (D15) first. Each one has at least 4.5:1 contrast
// on its own tint (`categoryTints`), where the chips and icon tiles draw it as text.
export const CATEGORY_COLOR_SWATCHES = [
  "#c62828",
  "#b34a14",
  "#8d6212",
  "#5f6e14",
  "#26784d",
  "#0b6e78",
  "#0d64a0",
  "#3949ab",
  "#7a4fb3",
  "#ad1457",
  "#6d4c41",
  "#546e7a",
];

type Localized = Record<AdminLanguage, string>;

export interface CategoryFormValues {
  name: Localized;
  description: Localized;
  icon: LayerCategoryIcon;
  color: string;
  // No default: the admin must choose what the category's layers mark
  polarity: Polarity | null;
  temporal: boolean;
  // `thresholdPercentage: null`: the global threshold of GET /config
  useGlobalThreshold: boolean;
  threshold: string;
  resultLabels: { ok: Localized; flagged: Localized };
}

const localized = (text?: Localized): Localized => ({
  es: text?.es ?? "",
  en: text?.en ?? "",
});

export const toCategoryFormValues = (category?: AdminCategory): CategoryFormValues => ({
  name: localized(category?.name),
  description: localized(category?.description),
  icon: category?.icon ?? "layers",
  color: category?.color ?? CATEGORY_COLOR_SWATCHES[0],
  polarity: category?.polarity ?? null,
  temporal: category?.temporal ?? false,
  useGlobalThreshold: category ? category.thresholdPercentage === null : true,
  threshold:
    category?.thresholdPercentage != null ? String(category.thresholdPercentage) : "",
  resultLabels: {
    ok: localized(category?.resultLabels.ok),
    flagged: localized(category?.resultLabels.flagged),
  },
});

const trimmed = (text: Localized): Localized => ({
  es: text.es.trim(),
  en: text.en.trim(),
});

export const toCategoryInput = (values: CategoryFormValues): CategoryInput => {
  // The validator refuses to save without a polarity; never send a default.
  if (values.polarity === null) throw new Error("A category needs a polarity");
  return {
    name: trimmed(values.name),
    description: trimmed(values.description),
    icon: values.icon,
    color: values.color.trim(),
    polarity: values.polarity,
    temporal: values.temporal,
    thresholdPercentage: values.useGlobalThreshold ? null : Number(values.threshold),
    resultLabels: {
      ok: trimmed(values.resultLabels.ok),
      flagged: trimmed(values.resultLabels.flagged),
    },
  };
};

// Validation rules for react-hook-form, mirroring the API's. Each returns true or
// the translation key of the problem.
export const categoryValidators = {
  required: (value: string) =>
    value.trim() !== "" || "admin:categories:form:errors:required",
  color: (value: string) =>
    COLOR_PATTERN.test(value.trim()) || "admin:categories:form:errors:color",
  threshold: (value: string, values: CategoryFormValues) => {
    if (values.useGlobalThreshold) return true;
    const threshold = Number(value);
    return (
      (value.trim() !== "" && threshold >= 0 && threshold <= 100) ||
      "admin:categories:form:errors:threshold"
    );
  },
  polarity: (value: Polarity | null) =>
    value !== null || "admin:categories:form:errors:polarity",
};
