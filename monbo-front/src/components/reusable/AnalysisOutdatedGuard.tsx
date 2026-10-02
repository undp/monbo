"use client";

import { useContext, useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DataContext } from "@/context/DataContext";

interface Props {
  locale: string;
  children: ReactNode;
}

/** Keep old analysis and report screens hidden while the updated raster is analysed. */
export const AnalysisOutdatedGuard = ({ locale, children }: Props) => {
  const { analysisOutdated } = useContext(DataContext);
  const router = useRouter();

  useEffect(() => {
    if (analysisOutdated) {
      router.replace(`/${locale}/deforestation-analysis/upload-data`);
    }
  }, [analysisOutdated, locale, router]);

  return analysisOutdated ? null : children;
};
