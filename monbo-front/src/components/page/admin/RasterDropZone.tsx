"use client";

import React from "react";
import { Box, Button, alpha, useTheme } from "@mui/material";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { rasterButtonSx } from "./rasterStyles";

/** Where the admin drops or selects the raster (.tif or .tiff, one file). */
export const RasterDropZone: React.FC<{ onFile: (file: File) => void }> = ({
  onFile,
}) => {
  const { t } = useTranslation();
  const primary = useTheme().palette.primary.main;
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: { "image/tiff": [".tif", ".tiff"] },
    multiple: false,
    noClick: true,
    onDropAccepted: ([file]) => onFile(file),
  });

  return (
    <Box
      {...getRootProps()}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        padding: "32px 24px",
        borderRadius: "12px",
        border: `2px dashed ${isDragActive ? primary : alpha(primary, 0.55)}`,
        backgroundColor: isDragActive ? alpha(primary, 0.12) : "grey.100",
        transition: "background-color .15s, border-color .15s",
        textAlign: "center",
      }}
    >
      <input {...getInputProps()} />
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: "common.white",
          color: "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <FileUploadOutlinedIcon />
      </Box>
      <Box sx={{ fontSize: 18, fontWeight: 500, color: "text.primary" }}>
        {isDragActive ? t("admin:raster:drop:active") : t("admin:raster:drop:title")}
      </Box>
      <Box sx={{ fontSize: 14, color: "text.secondary" }}>
        {t("admin:raster:drop:or")}
      </Box>
      <Button variant="contained" onClick={open} sx={rasterButtonSx}>
        {t("admin:raster:drop:button")}
      </Button>
      <Box sx={{ fontSize: 13, color: "text.secondary" }}>
        {t("admin:raster:drop:hint")}
      </Box>
    </Box>
  );
};
