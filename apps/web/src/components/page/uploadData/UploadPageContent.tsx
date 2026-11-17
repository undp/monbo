"use client";

import { Box } from "@mui/material";
import { Text } from "@/components/reusable/Text";
import React from "react";
import { StageEyebrow } from "@/components/page/flow/StageEyebrow";

interface Props {
  title: string;
  children: React.ReactNode;
}

// The flow header above shows the testing-environment warning.
export const UploadPageContent: React.FC<Props> = ({ title, children }) => {
  return (
    <Box
      sx={{
        padding: 1.5,
        paddingTop: 3,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Box sx={{ marginLeft: 1.5 }}>
        <StageEyebrow />
        <Text variant="h3" bold>
          {title}
        </Text>
      </Box>
      {children}
    </Box>
  );
};
