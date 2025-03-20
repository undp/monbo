"use client";

import { Box } from "@mui/material";
import { Text } from "@/components/reusable/Text";
import React from "react";
import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";

interface Props {
  title: string;
  children: React.ReactNode;
}

export const UploadPageContent: React.FC<Props> = ({ title, children }) => {
  return (
    <Box
      sx={{
        padding: 1.5,
        paddingTop: 3,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minHeight: "calc(100vh - 64px)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text variant="h3" sx={{ marginLeft: 1.5 }} bold>
          {title}
        </Text>
        <DevEnvWarning />
      </Box>
      {children}
    </Box>
  );
};
