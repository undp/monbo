"use client";

import { Box } from "@mui/material";
import { Text } from "@/components/reusable/Text";
import { Accept, FileRejection, useDropzone } from "react-dropzone";
import React, { useCallback, useContext } from "react";
import { SnackbarContext } from "@/context/SnackbarContext";
import { useTranslation } from "react-i18next";
import { uniqBy } from "lodash";

interface DropZoneProps {
  onDrop: (acceptedFiles: File[]) => void;
  accept?: Accept;
  texts: {
    inactiveDragzoneCallToAction: string;
    activeDragzoneCallToAction: string;
    buttonText: string;
    text: string;
  };
  disabled?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onDrop,
  accept,
  texts,
  disabled,
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
            message: t(`common:fileErrors:${e.code}`),
            type: "error",
          });
        });
        return;
      }

      onDrop(acceptedFiles);
    },
    [onDrop, openSnackbar, t]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleOnDrop,
    accept,
    multiple: false,
    disabled,
  });

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
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <Text variant="h3" textAlign="center" bold boldWeight={600}>
            {texts.activeDragzoneCallToAction}
          </Text>
        ) : (
          <>
            <Text variant="h3" textAlign="center" bold boldWeight={600}>
              {texts.inactiveDragzoneCallToAction}
            </Text>
            <Text variant="body1" textAlign="center">
              <Text
                variant="body1"
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
              .xlsx {t("_or")} .xls
            </Text>
          </>
        )}
      </Box>
    </Box>
  );
};
