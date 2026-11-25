"use client";

import React, { useId } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Box, Button, IconButton, TextField } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import {
  FieldName,
  MANDATORY_FIELDS,
  MAX_DOCUMENTS,
  TextField as TextFieldName,
} from "./ManualFarmModalForm";
import { FIELD } from "@/components/reusable/inputs/fieldStyles";
import { EYEBROW } from "./manualFarmStyles";
import { ManualFarmForm } from "./useManualFarmForm";

const GROUP = { display: "flex", flexDirection: "column", gap: 1.75 } as const;

/** The farm's data, the template's fields: the mandatory ones, then the optional
 * ones and up to 3 documents. A point farm also asks for its area. */
export const ManualFarmFields: React.FC<{
  form: ManualFarmForm;
  showArea: boolean;
}> = ({ form, showArea }) => {
  const { t } = useTranslation();
  const { values, fieldErrors, rowErrors } = form;
  const mandatoryId = useId();
  const optionalId = useId();

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
      // A field's own sx adds to the shared look (MUI's array form)
      sx={[FIELD, ...(Array.isArray(extra?.sx) ? extra.sx : [extra?.sx])]}
    />
  );
  const decimal = { slotProps: { htmlInput: { inputMode: "decimal" } } } as const;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <Box component="section" aria-labelledby={mandatoryId} sx={GROUP}>
        <Box component="h3" id={mandatoryId} sx={EYEBROW}>
          {t("manualFarm:fields:mandatoryTitle")}
        </Box>
        {textField("producerName")}
        {textField("productionDate", {
          type: "date",
          slotProps: { inputLabel: { shrink: true } },
        })}
        {textField("productionQuantity", decimal)}
        {textField("productionQuantityUnit")}
        {textField("cropType")}
        {showArea && textField("area", { required: true, ...decimal })}
      </Box>

      <Box component="section" aria-labelledby={optionalId} sx={GROUP}>
        <Box component="h3" id={optionalId} sx={EYEBROW}>
          {t("manualFarm:fields:optionalTitle")}
        </Box>
        {textField("id")}
        {textField("region")}
        {textField("association")}
        {values.documents.map((document, index) => (
          // A document's name and link, as one card with its remove button
          <Box
            key={index}
            sx={{
              display: "flex",
              gap: 0.5,
              alignItems: "flex-start",
              padding: "12px 6px 12px 12px",
              borderRadius: "12px",
              border: `1px solid ${FLOW_COLORS.line}`,
              backgroundColor: FLOW_COLORS.white,
            }}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, flex: 1, minWidth: 0 }}>
              <TextField
                label={t("manualFarm:fields:documentName", { number: index + 1 })}
                value={document.name}
                onChange={(event) =>
                  form.setDocument(index, "name", event.target.value)
                }
                size="small"
                fullWidth
                sx={FIELD}
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
                sx={FIELD}
              />
            </Box>
            <IconButton
              aria-label={t("manualFarm:actions:removeDocument")}
              onClick={() => form.removeDocument(index)}
              sx={{ color: FLOW_COLORS.muted, "&:hover": { color: FLOW_COLORS.bad } }}
            >
              <DeleteOutlineIcon />
            </IconButton>
          </Box>
        ))}
        {values.documents.length < MAX_DOCUMENTS && (
          <Button
            startIcon={<AddIcon />}
            onClick={form.addDocument}
            sx={{
              alignSelf: "flex-start",
              textTransform: "none",
              fontSize: 14,
              fontWeight: 600,
              color: FLOW_COLORS.blue,
              borderRadius: "10px",
            }}
          >
            {t("manualFarm:actions:addDocument")}
          </Button>
        )}
      </Box>
      {rowErrors.length > 0 && (
        <Alert severity="error" sx={{ borderRadius: "10px" }}>
          {rowErrors.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </Alert>
      )}
    </Box>
  );
};
