"use client";

import { Fragment, useContext, useEffect, useState } from "react";
import { Box, Divider, Link, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { useAvailableCountries } from "@/hooks/useAvailableCountries";
import { useCountryLayerCatalog } from "@/hooks/useCountryLayerCatalog";
import {
  DOCUMENTATION_SECTIONS,
  FORMER_SECTION_ANCHORS,
  fillDocumentationPlaceholders,
  sectionTitle,
  type DocumentationContent,
} from "@/utils/documentation";
import { CountryLayersSection } from "./CountryLayersSection";
import { DocumentationMarkdown } from "./DocumentationMarkdown";
import { LayerLimitsSection } from "./LayerLimitsSection";
import { HEADING_FONT, SCROLL_MARGIN_TOP } from "./methodologyStyles";

const HERO_IMAGE = "/images/landing/aerial-forest-river-farm-plots.webp";
// The fixed header (64 px) plus some air: where the side index sticks.
const INDEX_TOP = 88;

/**
 * The methodology page's body: a hero, an index (beside the content from 900 px,
 * above it on phones) and one section per Markdown file, with the deployment's
 * thresholds filled in. The layers and limits sections add the layers of the
 * country chosen in their tabs, a choice that stays on this page: the session's
 * analysis country is read, never written.
 */
export const MethodologyDocument: React.FC<{ content: DocumentationContent }> = ({ content }) => {
  const { t, i18n } = useTranslation();
  const colors = useTheme().palette.landing;
  const { selectedCountry } = useContext(DataContext);
  const { countries, loading, error } = useAvailableCountries();
  const [chosenCountry, setChosenCountry] = useState<string | null>(null);

  // The tab the user chose; until then the session's country, else the first one.
  const isAvailable = (code: string | null) => countries.some((c) => c.code === code);
  const country = isAvailable(chosenCountry)
    ? chosenCountry
    : isAvailable(selectedCountry)
      ? selectedCountry
      : (countries[0]?.code ?? null);
  const countryName = countries.find((c) => c.code === country)?.name ?? null;
  const catalog = useCountryLayerCatalog(country, i18n.language);

  // The page renders once GET /config answers, after the browser looked for the
  // URL's anchor: go to it now, so /documentation#layers opens at its section.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  const index = (
    <Box component="ol" sx={{ m: 0, p: 0, listStyle: "none" }}>
      {DOCUMENTATION_SECTIONS.map((section) => (
        <li key={section}>
          <Link
            href={`#${section}`}
            underline="hover"
            sx={{
              display: "block",
              py: 0.875,
              px: 1.5,
              fontSize: 14,
              color: colors.inkSecondary,
              borderLeft: `2px solid ${colors.line}`,
              "&:hover": { color: colors.blue, borderColor: colors.blue },
            }}
          >
            {sectionTitle(content[section])}
          </Link>
        </li>
      ))}
    </Box>
  );

  return (
    <Box sx={{ backgroundColor: colors.background, color: "#3A3541" }}>
      <Box
        sx={{
          color: "common.white",
          py: { xs: 4, md: "46px" },
          background: `linear-gradient(100deg, rgba(10, 36, 64, 0.95), rgba(14, 59, 48, 0.82)), url(${HERO_IMAGE}) 30% 50% / cover`,
        }}
      >
        <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2, sm: 3 } }}>
          <Typography
            sx={{
              font: "700 12px/1 var(--font-roboto), sans-serif",
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: colors.leafLight,
            }}
          >
            {t("methodology:eyebrow")}
          </Typography>
          <Typography
            variant="h1"
            sx={{
              fontFamily: HEADING_FONT,
              fontWeight: 800,
              lineHeight: 1.15,
              fontSize: { xs: 30, md: 38 },
              letterSpacing: "-.015em",
              mt: 1.25,
            }}
          >
            {t("methodology:title")}
          </Typography>
          <Typography sx={{ opacity: 0.82, maxWidth: 640, mt: 1, fontSize: 16 }}>
            {t("methodology:subtitle")}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          maxWidth: 1180,
          mx: "auto",
          px: { xs: 2, sm: 3 },
          pt: 4,
          pb: 10,
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "220px minmax(0, 1fr)" },
          gap: { xs: 3, md: "34px" },
        }}
      >
        <Box
          component="nav"
          aria-label={t("methodology:contents")}
          sx={{
            alignSelf: "start",
            position: { md: "sticky" },
            top: { md: INDEX_TOP },
            border: { xs: `1px solid ${colors.line}`, md: 0 },
            borderRadius: 2,
            backgroundColor: { xs: "common.white", md: "transparent" },
            p: { xs: 2, md: 0 },
          }}
        >
          <Typography
            sx={{
              display: { xs: "block", md: "none" },
              fontWeight: 600,
              mb: 1,
              color: colors.ink,
            }}
          >
            {t("methodology:contents")}
          </Typography>
          {index}
        </Box>

        <Box sx={{ maxWidth: 880, minWidth: 0 }}>
          {DOCUMENTATION_SECTIONS.map((section, position) => {
            const formerAnchor = FORMER_SECTION_ANCHORS[section];
            return (
              <Fragment key={section}>
                {position > 0 && <Divider sx={{ my: 6 }} />}
                <Box component="section" id={section} sx={{ scrollMarginTop: SCROLL_MARGIN_TOP }}>
                  {formerAnchor && (
                    <Box
                      component="span"
                      id={formerAnchor}
                      sx={{ display: "block", scrollMarginTop: SCROLL_MARGIN_TOP }}
                    />
                  )}
                  <DocumentationMarkdown>
                    {fillDocumentationPlaceholders(content[section], i18n.language)}
                  </DocumentationMarkdown>
                  {section === "layers" && (
                    <CountryLayersSection
                      countries={countries}
                      countriesLoading={loading}
                      countriesError={error}
                      country={country}
                      onSelectCountry={setChosenCountry}
                      catalog={catalog}
                    />
                  )}
                  {section === "limits" && (
                    <LayerLimitsSection countryName={countryName} catalog={catalog} />
                  )}
                </Box>
              </Fragment>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};
