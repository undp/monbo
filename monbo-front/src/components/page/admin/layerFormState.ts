import {
  ADMIN_LANGUAGES,
  AdminLanguage,
  AdminLayer,
  LayerAttributes,
  LayerInput,
  OPTIONAL_ATTRIBUTE_KEYS,
} from "@/interfaces/AdminLayer";

// The form's values: what the user types, converted to LayerInput on save.
export interface LayerFormValues {
  pixel_size: string;
  baseline: string;
  compared_against: string;
  // useFieldArray needs objects, not plain strings
  references: { url: string }[];
  available_countries_codes: string[];
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
    const stored = layer?.attributes[language] ?? {};
    attributes[language] = emptyAttributes();
    for (const key of Object.keys(attributes[language]) as (keyof LayerAttributes)[]) {
      attributes[language][key] = stored[key] ?? "";
    }
    considerations[language] = layer?.considerations[language] ?? "";
  }
  return {
    pixel_size: layer ? String(layer.pixel_size) : "30",
    // New layers start at 2020, the baseline most layers use
    baseline: layer?.baseline != null ? String(layer.baseline) : "2020",
    compared_against:
      layer?.compared_against != null ? String(layer.compared_against) : "",
    references: (layer?.references ?? []).map((url) => ({ url })),
    available_countries_codes: layer ? [...layer.available_countries_codes] : [],
    attributes,
    considerations,
  };
};

export const toLayerInput = (values: LayerFormValues): LayerInput => {
  const attributes = {} as LayerInput["attributes"];
  const considerations = {} as LayerInput["considerations"];
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
    pixel_size: Number(values.pixel_size),
    baseline: Number(values.baseline),
    compared_against: Number(values.compared_against),
    references: values.references.map((r) => r.url.trim()).filter(Boolean),
    available_countries_codes: values.available_countries_codes,
    attributes,
    considerations,
  };
};

// Validation rules for react-hook-form, mirroring the API's. Each returns true or
// the translation key of the problem.
const isYear = (value: string) =>
  /^\d{4}$/.test(value.trim()) && Number(value) >= 1900 && Number(value) <= 2100;

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
  countries: (codes: string[]) => codes.length > 0 || "admin:form:errors:countries",
  reference: (value: string) =>
    !value.trim() ||
    /^https?:\/\//.test(value.trim()) ||
    "admin:form:errors:reference",
};
