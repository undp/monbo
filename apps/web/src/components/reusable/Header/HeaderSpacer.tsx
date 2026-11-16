"use client";

import { Toolbar } from "@mui/material";
import { useIsStartPage } from "@/hooks/useIsStartPage";

/**
 * Keeps the page below the fixed header. The start page has none: its header is
 * drawn over the hero.
 */
export const HeaderSpacer: React.FC = () =>
  useIsStartPage() ? null : <Toolbar />;
