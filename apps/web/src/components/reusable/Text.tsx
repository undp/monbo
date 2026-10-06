import { Typography, TypographyProps } from "@mui/material";
import React from "react";

interface TextProps extends TypographyProps {
  bold?: boolean;
  color?: "primary" | "secondary";
  children: React.ReactNode;
  boldWeight?: 500 | 600 | 700;
}

export const Text: React.FC<TextProps> = ({
  bold,
  sx,
  color = "primary",
  boldWeight = 500,
  children,
  ...props
}) => {
  return (
    <Typography
      color={color === "primary" ? "textPrimary" : "textSecondary"}
      sx={{ fontWeight: bold ? boldWeight : 400, ...sx }}
      {...props}
    >
      {children}
    </Typography>
  );
};
