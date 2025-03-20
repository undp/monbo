import { Box } from "@mui/material";
import React from "react";
import { DropZone } from "../../reusable/DropZone";
import { Accept } from "react-dropzone";

interface UploadFileStepProps {
  texts: {
    inactiveDragzoneCallToAction: string;
    activeDragzoneCallToAction: string;
    buttonText: string;
    text: string;
  };
  fileAccept?: Accept;
  onDrop: (acceptedFiles: File[]) => void;
  disabled?: boolean;
}
export const UploadFileStep: React.FC<UploadFileStepProps> = ({
  texts,
  fileAccept,
  onDrop,
  disabled,
}) => {
  return (
    <Box sx={{ display: "flex", flexGrow: 1 }}>
      <DropZone
        onDrop={onDrop}
        accept={fileAccept}
        texts={texts}
        disabled={disabled}
      />
    </Box>
  );
};
