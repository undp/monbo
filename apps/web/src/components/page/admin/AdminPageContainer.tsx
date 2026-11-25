"use client";

import React, { useContext } from "react";
import { Box } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FlowPageHead } from "@/components/page/flow/FlowPageHead";
import { FLOW_COLORS, FLOW_CONTENT_MAX_WIDTH } from "@/components/page/flow/flowStyles";
import { PageEyebrow } from "@/components/page/flow/PageEyebrow";
import { AdminSessionContext } from "@/context/AdminSessionContext";
import { AS_TEXT } from "@/utils/asText";
import { getCountryName } from "@/utils/countries";
import { localizedPath } from "@/utils/languageChange";

interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** A link above the head, back to the list an editor belongs to. */
  back?: { label: string; path: string };
  children: React.ReactNode;
  // The layer and category pages administer the session's country, so their
  // eyebrow names it. A page about every country (usage) turns it off.
  countryInTitle?: boolean;
}

/**
 * A signed-in admin page's head and body, as the stage pages': "Admin · {country}",
 * the title, the subtitle and the page's actions, then the content. The session
 * check and the sidebar are the layout's (AdminShell).
 */
export const AdminPageContainer: React.FC<Props> = ({
  title,
  subtitle,
  actions,
  back,
  children,
  countryInTitle = true,
}) => {
  const { t, i18n } = useTranslation();
  const { session } = useContext(AdminSessionContext);
  const country = session
    ? (getCountryName(session.country, i18n.language as "en" | "es") ?? session.country)
    : null;

  return (
    <Box
      sx={{
        paddingX: { xs: 2, md: 4 },
        paddingTop: { xs: 3, md: 4 },
        paddingBottom: { xs: 4, md: 6 },
      }}
    >
      <Box
        sx={{
          maxWidth: FLOW_CONTENT_MAX_WIDTH,
          marginX: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
        }}
      >
        <Box>
          {back && (
            <Box
              component={Link}
              href={localizedPath(back.path, i18n.language)}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                marginBottom: 2,
                fontSize: 14,
                fontWeight: 600,
                color: FLOW_COLORS.blue,
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              <ArrowBackIcon sx={{ fontSize: 18 }} aria-hidden />
              {back.label}
            </Box>
          )}
          <FlowPageHead
            eyebrow={
              <PageEyebrow>
                {countryInTitle && country
                  ? t("admin:eyebrow", { country, ...AS_TEXT })
                  : t("admin:eyebrowAll")}
              </PageEyebrow>
            }
            title={title}
            subtitle={subtitle}
            actions={
              actions && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>{actions}</Box>
              )
            }
          />
        </Box>
        {children}
      </Box>
    </Box>
  );
};
