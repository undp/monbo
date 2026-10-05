"use client";

import { Box, Button } from "@mui/material";
import { Text } from "@/components/reusable/Text";
import { SectionBackground } from "@/components/reusable/SectionBackground";
import DownloadIcon from "@mui/icons-material/Download";
import React from "react";

interface DownloadTemplateStepProps {
  title: string;
  description: string;
  buttonText: string;
  fileUrl: string;
}
export const DownloadTemplateStep: React.FC<DownloadTemplateStepProps> = ({
  title,
  description,
  buttonText,
  fileUrl,
}) => {
  return (
    <SectionBackground
      sx={{
        backgroundColor: "#F5F5F5",
        padding: 2,
        borderRadius: 2,
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <Box>
        <Text variant="body1" bold>
          {title}
        </Text>
        <Text variant="body1" color="secondary">
          {description}
        </Text>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", marginLeft: 12 }}>
        <a target="_blank" href={fileUrl} rel="noopener noreferrer">
          <Button variant="contained" endIcon={<DownloadIcon />}>
            {buttonText}
          </Button>
        </a>
      </Box>
    </SectionBackground>
  );
};
