"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  FieldName,
  MANDATORY_FIELDS,
  MAX_DOCUMENTS,
  TextField as TextFieldName,
} from "./ManualFarmModalForm";
import { ManualFarmForm } from "./useManualFarmForm";

/** The farm's data, the template's fields: the mandatory ones, then the optional
 * ones and up to 3 documents. A point farm also asks for its area. */
export const ManualFarmFields: React.FC<{
  form: ManualFarmForm;
  showArea: boolean;
}> = ({ form, showArea }) => {
  const { t } = useTranslation();
  const { values, fieldErrors, rowErrors } = form;

  const errorText = (field: FieldName) => {
    const error = fieldErrors[field];
    return error ? t(`manualFarm:fieldErrors:${error}`) : undefined;
  };

  const textField = (
    field: TextFieldName,
    extra?: Partial<React.ComponentProps<typeof TextField>>
  ) => (
    <TextField
      key={field}
      name={field}
      label={t(`manualFarm:fields:${field}`)}
      value={values[field]}
      onChange={(event) => form.setField(field, event.target.value)}
      required={(MANDATORY_FIELDS as readonly string[]).includes(field)}
      error={!!fieldErrors[field]}
      helperText={errorText(field)}
      size="small"
      fullWidth
      {...extra}
    />
  );
  const decimal = { slotProps: { htmlInput: { inputMode: "decimal" } } } as const;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <Typography variant="subtitle2">
        {t("manualFarm:fields:mandatoryTitle")}
      </Typography>
      {textField("producerName")}
      {textField("productionDate", {
        type: "date",
        slotProps: { inputLabel: { shrink: true } },
      })}
      {textField("productionQuantity", decimal)}
      {textField("productionQuantityUnit")}
      {textField("cropType")}
      {showArea && textField("area", { required: true, ...decimal })}

      <Typography variant="subtitle2">
        {t("manualFarm:fields:optionalTitle")}
      </Typography>
      {textField("id")}
      {textField("region")}
      {textField("association")}
      {values.documents.map((document, index) => (
        <Box
          key={index}
          sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
            <TextField
              label={t("manualFarm:fields:documentName", { number: index + 1 })}
              value={document.name}
              onChange={(event) =>
                form.setDocument(index, "name", event.target.value)
              }
              size="small"
              fullWidth
            />
            <TextField
              label={t("manualFarm:fields:documentUrl", { number: index + 1 })}
              value={document.url}
              onChange={(event) =>
                form.setDocument(index, "url", event.target.value)
              }
              error={!!fieldErrors[`documentUrl.${index}`]}
              helperText={errorText(`documentUrl.${index}`)}
              size="small"
              fullWidth
              slotProps={{ htmlInput: { inputMode: "url" } }}
            />
          </Box>
          <IconButton
            aria-label={t("manualFarm:actions:removeDocument")}
            onClick={() => form.removeDocument(index)}
          >
            <DeleteOutlineIcon />
          </IconButton>
        </Box>
      ))}
      {values.documents.length < MAX_DOCUMENTS && (
        <Button
          startIcon={<AddIcon />}
          onClick={form.addDocument}
          sx={{ alignSelf: "flex-start" }}
        >
          {t("manualFarm:actions:addDocument")}
        </Button>
      )}
      {rowErrors.length > 0 && (
        <Alert severity="error">
          {rowErrors.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </Alert>
      )}
    </Box>
  );
};
