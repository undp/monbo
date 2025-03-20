"use client";

import { AppBar, Toolbar } from "@mui/material";

interface FooterProps {
  children?: React.ReactNode;
}

export const Footer: React.FC<FooterProps> = ({ children }) => {
  return (
    <AppBar sx={{ top: "unset", bottom: 0, backgroundColor: "white" }}>
      <Toolbar>{children}</Toolbar>
    </AppBar>
  );
};
