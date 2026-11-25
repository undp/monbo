"use client";

import { Box, Chip } from "@mui/material";
import { Accept } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { DropZone } from "@/components/reusable/DropZone";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";

interface PairDropZoneProps {
  file: File | null;
  onFile: (file: File | null) => void;
  accept: Accept;
  disabled?: boolean;
  title: string;
  extensions: string;
  invalidTypeMessage: string;
}

/** One of option 3's two files: a drop zone, or the chosen file. */
export const PairDropZone: React.FC<PairDropZoneProps> = ({
  file,
  onFile,
  accept,
  disabled,
  title,
  extensions,
  invalidTypeMessage,
}) => {
  const { t } = useTranslation();
  if (file)
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          minHeight: 160,
          padding: 2,
          borderRadius: "12px",
          border: `1.5px solid ${FLOW_COLORS.line}`,
          backgroundColor: FLOW_COLORS.white,
        }}
      >
        <Box component="b" sx={{ fontSize: 14, color: FLOW_COLORS.ink2 }}>
          {title}
        </Box>
        <Chip
          label={file.name}
          onDelete={() => onFile(null)}
          sx={{ maxWidth: "100%" }}
        />
      </Box>
    );
  return (
    <Box sx={{ display: "flex" }}>
      <DropZone
        appearance="flow"
        compact
        disabled={disabled}
        onDrop={(files) => onFile(files[0] ?? null)}
        accept={accept}
        invalidTypeMessage={invalidTypeMessage}
        texts={{
          inactiveDragzoneCallToAction: title,
          activeDragzoneCallToAction: t("common:farmsUpload:dropzoneActive"),
          text: t("common:farmsUpload:browsePrefix"),
          buttonText: t("common:farmsUpload:browse"),
          allowedExtensions: extensions,
        }}
      />
    </Box>
  );
};
