"use client";

import { useContext } from "react";
import Link from "next/link";
import { Box } from "@mui/material";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import { Trans, useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { getCountryName } from "@/utils/countries";
import { localizedPath } from "@/utils/languageChange";
import { DevEnvWarning } from "@/components/reusable/DevEnvWarning";
import { SHOW_TESTING_ENVIRONMENT_WARNING } from "@/config/env";
import { FlowStepper } from "./FlowStepper";
import {
  FLOW_COLORS,
  FLOW_CONTENT_MAX_WIDTH,
  flowHeaderBackground,
} from "./flowStyles";

/**
 * The band above every stage page: the analysis country, the free-use note and
 * the stepper, over the forest image.
 */
export const FlowHeader: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { selectedCountry } = useContext(DataContext);
  const language = i18n.language === "en" ? "en" : "es";
  const countryName = selectedCountry
    ? (getCountryName(selectedCountry, language) ?? selectedCountry)
    : "";

  return (
    <Box
      component="section"
      sx={{
        color: FLOW_COLORS.white,
        background: flowHeaderBackground,
        paddingTop: { xs: 2, md: 2.75 },
        paddingBottom: { xs: 2.5, md: 3.25 },
        paddingX: { xs: 2, md: 3 },
      }}
    >
      <Box sx={{ maxWidth: FLOW_CONTENT_MAX_WIDTH, marginX: "auto" }}>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            columnGap: 1.25,
            rowGap: 1,
            fontSize: 13,
            marginBottom: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, opacity: 0.85 }}>
            <PlaceOutlinedIcon sx={{ fontSize: 16 }} aria-hidden />
            <span>
              <Trans
                i18nKey="flow:header.analysisIn"
                values={{ country: countryName }}
                components={{ b: <b /> }}
              />
            </span>
            <span aria-hidden>·</span>
            <Box
              component={Link}
              href={localizedPath("/", i18n.language)}
              sx={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              {t("flow:header.changeCountry")}
            </Box>
          </Box>
          {SHOW_TESTING_ENVIRONMENT_WARNING && <DevEnvWarning />}
          <Box
            sx={{
              marginLeft: { md: "auto" },
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              opacity: 0.85,
            }}
          >
            <LockOpenOutlinedIcon sx={{ fontSize: 16 }} aria-hidden />
            {t("flow:header.freeNote")}
          </Box>
        </Box>
        <FlowStepper />
      </Box>
    </Box>
  );
};
