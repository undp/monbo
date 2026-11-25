"use client";

import { Box } from "@mui/material";
import { Text } from "@/components/reusable/Text";
import { Accept, FileRejection, useDropzone } from "react-dropzone";
import React, { useCallback, useContext } from "react";
import { SnackbarContext } from "@/context/SnackbarContext";
import { useTranslation } from "react-i18next";
import { uniqBy } from "lodash";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";

interface DropZoneProps {
  onDrop: (acceptedFiles: File[]) => void;
  accept?: Accept;
  texts: {
    inactiveDragzoneCallToAction: string;
    activeDragzoneCallToAction: string;
    buttonText: string;
    text: string;
    // The accepted formats, under the call to action. Excel's by default.
    allowedExtensions?: string;
  };
  disabled?: boolean;
  // Several files at once (each one is handled on its own)
  multiple?: boolean;
  // Shown instead of the generic "invalid file type", e.g. to say where it goes
  invalidTypeMessage?: string;
  // Smaller text, for a drop zone inside a card
  compact?: boolean;
  // The stage pages' look: an upload icon over the texts, on a white rounded box
  appearance?: "default" | "flow";
}

export const DropZone: React.FC<DropZoneProps> = ({
  onDrop,
  accept,
  texts,
  disabled,
  multiple = false,
  invalidTypeMessage,
  compact = false,
  appearance = "default",
}) => {
  const { openSnackbar } = useContext(SnackbarContext);
  const { t } = useTranslation();

  const handleOnDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (fileRejections.length > 0) {
        uniqBy(
          fileRejections.flatMap((fr) => fr.errors),
          "code"
        ).forEach((e) => {
          openSnackbar({
            message:
              e.code === "file-invalid-type" && invalidTypeMessage
                ? invalidTypeMessage
                : t(`common:fileErrors:${e.code}`),
            type: "error",
          });
        });
        return;
      }

      onDrop(acceptedFiles);
    },
    [onDrop, openSnackbar, t, invalidTypeMessage]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleOnDrop,
    accept,
    multiple,
    disabled,
  });

  if (appearance === "flow")
    return (
      <Box
        {...getRootProps()}
        sx={{
          flexGrow: 1,
          minHeight: 160,
          border: `1.5px dashed ${isDragActive ? FLOW_COLORS.blue : "#a9c4dc"}`,
          borderRadius: "12px",
          backgroundColor: isDragActive ? FLOW_COLORS.blue25 : FLOW_COLORS.white,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          padding: compact ? 2 : "22px",
          textAlign: "center",
          color: FLOW_COLORS.ink2,
          fontSize: 14,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "border-color .15s, background-color .15s",
          "&:hover": disabled ? undefined : { borderColor: FLOW_COLORS.blue },
        }}
      >
        <input {...getInputProps()} />
        <Box
          aria-hidden
          sx={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            backgroundColor: FLOW_COLORS.blue50,
            color: FLOW_COLORS.blue,
          }}
        >
          <FileUploadOutlinedIcon />
        </Box>
        <Box component="b" sx={{ color: FLOW_COLORS.ink2, fontWeight: 700 }}>
          {isDragActive
            ? texts.activeDragzoneCallToAction
            : texts.inactiveDragzoneCallToAction}
        </Box>
        {!isDragActive && (
          <>
            <Box component="span">
              {texts.text}{" "}
              <Box component="span" sx={{ color: FLOW_COLORS.blue }}>
                {texts.buttonText}
              </Box>
            </Box>
            <Box component="small" sx={{ color: FLOW_COLORS.muted, fontSize: 13 }}>
              {texts.allowedExtensions ?? `.xlsx ${t("_or")} .xls`}
            </Box>
          </>
        )}
      </Box>
    );

  return (
    <Box
      {...getRootProps()}
      sx={{
        flexGrow: 1,
        border: "1px dashed #03689E",
        backgroundColor: "#3463761A",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: compact ? 1.5 : undefined,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: compact ? 0.5 : 1,
        }}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <Text
            variant={compact ? "body1" : "h3"}
            textAlign="center"
            bold
            boldWeight={600}
          >
            {texts.activeDragzoneCallToAction}
          </Text>
        ) : (
          <>
            <Text
              variant={compact ? "body1" : "h3"}
              textAlign="center"
              bold
              boldWeight={600}
            >
              {texts.inactiveDragzoneCallToAction}
            </Text>
            <Text variant={compact ? "body2" : "body1"} textAlign="center">
              <Text
                variant={compact ? "body2" : "body1"}
                component="span"
                sx={{
                  color: "primary.main",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                {texts.buttonText}
              </Text>{" "}
              {texts.text}
            </Text>
            <Text color="secondary" variant="body2" textAlign="center">
              {texts.allowedExtensions ?? `.xlsx ${t("_or")} .xls`}
            </Text>
          </>
        )}
      </Box>
    </Box>
  );
};
