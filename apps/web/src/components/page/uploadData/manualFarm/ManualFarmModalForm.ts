import { TFunction } from "i18next";
import { format } from "date-fns";
import { FarmRow } from "@/interfaces/FarmRow";
import { Drawing, drawingToGeometryFields } from "@/utils/drawing";
import { EXCEL_MANDATORY_HEADERS, validateData } from "@/utils/excel";

// The manual farm modal's form: its values, the row they make with the drawing,
// and their validation. Kept apart from the component so it can be tested without
// Google Maps.

export const MAX_DOCUMENTS = 3;

export interface ManualFarmValues {
  id: string;
  producerName: string;
  // yyyy-MM-dd, as a date input gives it
  productionDate: string;
  productionQuantity: string;
  productionQuantityUnit: string;
  cropType: string;
  region: string;
  association: string;
  // Hectares; only a point farm has it
  area: string;
  documents: { name: string; url: string }[];
}

export type TextField = Exclude<keyof ManualFarmValues, "documents">;
// A document's fields, by position: `documentUrl.0`
export type DocumentField = `documentName.${number}` | `documentUrl.${number}`;
export type FieldName = TextField | DocumentField;

export type FieldError = "required" | "number" | "positive" | "url";
export type FieldErrors = Partial<Record<FieldName, FieldError>>;

// The template's mandatory columns, as form fields (the coordinates come from the
// drawing). A point also needs its area.
export const MANDATORY_FIELDS = [
  "producerName",
  "productionDate",
  "productionQuantity",
  "productionQuantityUnit",
  "cropType",
] as const satisfies readonly TextField[];

export const emptyValues = (): ManualFarmValues => ({
  id: "",
  producerName: "",
  productionDate: "",
  productionQuantity: "",
  productionQuantityUnit: "",
  cropType: "",
  region: "",
  association: "",
  area: "",
  documents: [],
});

/**
 * A number as users write it, with the API's rules (utils/numbers.py): in Spanish
 * "1.234,5" or "1234,5", in English "1,234.5" or "1234.5". Null if it isn't one.
 */
export const parseLocaleNumber = (
  value: string,
  language: string
): number | null => {
  const text = value.replace(/\s/g, "");
  if (language === "es") {
    if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(text)) return null;
    return Number(text.replace(/\./g, "").replace(",", "."));
  }
  if (!/^-?\d{1,3}(,\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text.replace(/,/g, ""));
};

const formatLocaleNumber = (value: number, language: string) =>
  language === "es" ? String(value).replace(".", ",") : String(value);

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") && !!url.host
    );
  } catch {
    return false;
  }
};

// A date input's value as the Excel loader writes dates: the ISO string of local
// midnight, so it shows as the same day.
const dateInputToIso = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toISOString();
};

const isoToDateInput = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd");
};

const text = (value: unknown) =>
  value === null || value === undefined ? "" : String(value);

/** A listed row's data as the form's values, for edit mode. */
export const rowToValues = (
  row: FarmRow,
  language: string
): ManualFarmValues => {
  const number = (value: unknown) =>
    typeof value === "number"
      ? formatLocaleNumber(value, language)
      : text(value);
  return {
    id: text(row.id),
    producerName: text(row.producerName),
    productionDate: row.productionDate
      ? isoToDateInput(row.productionDate)
      : "",
    productionQuantity: number(row.productionQuantity),
    productionQuantityUnit: text(row.productionQuantityUnit),
    cropType: text(row.cropType),
    region: text(row.region),
    association: text(row.association),
    area: row.geometryType === "Point" ? number(row.area) : "",
    documents: row.documents
      .slice(0, MAX_DOCUMENTS)
      .map(({ name, url }) => ({ name, url })),
  };
};

interface ValidateParams {
  values: ManualFarmValues;
  drawing: Drawing | null;
  t: TFunction<"translation", undefined>;
  language: string;
}

export interface ValidationResult {
  // Set when the farm can be added
  row: FarmRow | null;
  fieldErrors: FieldErrors;
  // The template's validation messages that name no field (the geometry's)
  rowErrors: string[];
  // There is no finished polygon or point
  missingGeometry: boolean;
}

/**
 * Validates the form and the drawing, and builds the farm's row. The mandatory
 * fields are the template's, checked as `validateData` checks a row; numbers are
 * parsed as the API parses them and sent as numbers. Then the whole row goes
 * through `validateData`, as an Excel row does.
 */
export const validateManualFarm = ({
  values,
  drawing,
  t,
  language,
}: ValidateParams): ValidationResult => {
  const fieldErrors: FieldErrors = {};
  const trimmed = (field: TextField) => values[field].trim();
  const optional = (field: TextField) => trimmed(field) || null;

  MANDATORY_FIELDS.forEach((field) => {
    if (!trimmed(field)) fieldErrors[field] = "required";
  });

  const positiveNumber = (field: TextField) => {
    if (!trimmed(field)) {
      fieldErrors[field] = "required";
      return null;
    }
    const value = parseLocaleNumber(trimmed(field), language);
    if (value === null) fieldErrors[field] = "number";
    else if (value <= 0) fieldErrors[field] = "positive";
    return value;
  };
  const productionQuantity = positiveNumber("productionQuantity");
  const area = drawing?.type === "point" ? positiveNumber("area") : null;

  const documents = values.documents
    .slice(0, MAX_DOCUMENTS)
    .map(({ name, url }) => ({ name: name.trim(), url: url.trim() }));
  documents.forEach(({ name, url }, index) => {
    if (!url && name) fieldErrors[`documentUrl.${index}`] = "required";
    else if (url && !isHttpUrl(url))
      fieldErrors[`documentUrl.${index}`] = "url";
  });

  const geometry = drawing ? drawingToGeometryFields(drawing) : null;
  const missingGeometry = !geometry;
  if (Object.keys(fieldErrors).length > 0 || !geometry) {
    return { row: null, fieldErrors, rowErrors: [], missingGeometry };
  }

  const row: FarmRow = {
    id: optional("id"),
    producerName: trimmed("producerName"),
    productionDate: dateInputToIso(trimmed("productionDate")),
    productionQuantity,
    productionQuantityUnit: trimmed("productionQuantityUnit"),
    region: optional("region"),
    association: optional("association"),
    cropType: trimmed("cropType"),
    ...geometry,
    area,
    documents: documents.filter(({ url }) => url),
  };

  const rowErrors = validateData({
    data: [row as unknown as Record<string, string | number | null>],
    mandatoryHeaders: EXCEL_MANDATORY_HEADERS,
    t,
    language,
  });
  return {
    row: rowErrors.length ? null : row,
    fieldErrors,
    rowErrors,
    missingGeometry,
  };
};
