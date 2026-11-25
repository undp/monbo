import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FarmRow } from "@/interfaces/FarmRow";
import { Drawing } from "@/utils/drawing";
import {
  FieldErrors,
  FieldName,
  ManualFarmValues,
  TextField,
  validateManualFarm,
} from "./ManualFarmModalForm";

/**
 * The manual farm modal's fields: their values, their errors (a field's clears as
 * it is edited) and the validation that builds the farm's row with the drawing.
 */
export const useManualFarmForm = (initial: ManualFarmValues) => {
  const { t, i18n } = useTranslation();
  const [values, setValues] = useState<ManualFarmValues>(initial);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [rowErrors, setRowErrors] = useState<string[]>([]);

  const setField = (field: TextField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => withoutError(current, field));
  };

  const setDocument = (index: number, key: "name" | "url", value: string) => {
    setValues((current) => ({
      ...current,
      documents: current.documents.map((document, i) =>
        i === index ? { ...document, [key]: value } : document
      ),
    }));
    setFieldErrors((current) => withoutError(current, `documentUrl.${index}`));
  };

  const addDocument = () =>
    setValues((current) => ({
      ...current,
      documents: [...current.documents, { name: "", url: "" }],
    }));

  const removeDocument = (index: number) => {
    setValues((current) => ({
      ...current,
      documents: current.documents.filter((_, i) => i !== index),
    }));
    // The documents after it move up: their errors would point at the wrong one
    setFieldErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !key.startsWith("document"))
      )
    );
  };

  /** The farm's row, or null after showing why it can't be added. */
  const validate = (drawing: Drawing | null): FarmRow | null => {
    const result = validateManualFarm({
      values,
      drawing,
      t,
      language: i18n.language,
    });
    setFieldErrors(result.fieldErrors);
    setRowErrors(result.rowErrors);
    return result.row;
  };

  return {
    values,
    fieldErrors,
    rowErrors,
    setField,
    setDocument,
    addDocument,
    removeDocument,
    validate,
  };
};

export type ManualFarmForm = ReturnType<typeof useManualFarmForm>;

const withoutError = (errors: FieldErrors, field: FieldName): FieldErrors =>
  Object.fromEntries(
    Object.entries(errors).filter(([key]) => key !== field)
  ) as FieldErrors;
