"use client";

import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Box, Link, Typography, useTheme } from "@mui/material";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import SquareFootOutlinedIcon from "@mui/icons-material/SquareFootOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { STAGE_CARD } from "@/components/page/flow/flowStyles";
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
  type DocumentationSection,
} from "@/utils/documentation";
import { CountryLayersSection } from "./CountryLayersSection";
import { DocumentationMarkdown } from "./DocumentationMarkdown";
import { LayerLimitsSection } from "./LayerLimitsSection";
import { HEADING_FONT, SCROLL_MARGIN_TOP } from "./methodologyStyles";

const HERO_IMAGE = "/images/landing/aerial-forest-river-farm-plots.webp";
// The fixed header (64 px) plus some air: where the side index sticks.
const INDEX_TOP = 88;

// Each section's icon, beside its title, as a stage page's section has one
const SECTION_ICONS: Record<DocumentationSection, ReactNode> = {
  calculation: <CalculateOutlinedIcon />,
  categories: <CategoryOutlinedIcon />,
  layers: <LayersOutlinedIcon />,
  limits: <RuleOutlinedIcon />,
  upload: <UploadFileOutlinedIcon />,
  validation: <FactCheckOutlinedIcon />,
  area: <SquareFootOutlinedIcon />,
};

/**
 * The section being read: the last one whose top has passed under the fixed
 * header, for the side index to mark it. Null without IntersectionObserver.
 */
const useCurrentSection = (): string | null => {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = DOCUMENTATION_SECTIONS.map((id) => document.getElementById(id)).filter(
      (element): element is HTMLElement => !!element
    );
    const update = () => {
      // The last section whose top is above the band under the header
      const passed = sections.filter(
        (section) => section.getBoundingClientRect().top <= SCROLL_MARGIN_TOP + 40
      );
      setCurrent((passed.at(-1) ?? sections[0])?.id ?? null);
    };
    const observer = new IntersectionObserver(update, {
      rootMargin: `-${SCROLL_MARGIN_TOP}px 0px -50% 0px`,
      threshold: [0, 1],
    });
    sections.forEach((section) => observer.observe(section));
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, []);
  return current;
};

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
  const currentSection = useCurrentSection();

  // The page renders once GET /config answers, after the browser looked for the
  // URL's anchor: go to it now, so /documentation#layers opens at its section.
  // The layers section grows when its country's catalog arrives, which moves every
  // section below it (browsers without scroll anchoring don't compensate), so go
  // to the anchor again then, unless the reader has scrolled meanwhile.
  const pendingAnchor = useRef<{ id: string; scrollY: number } | null>(null);
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    target.scrollIntoView();
    pendingAnchor.current = { id, scrollY: window.scrollY };
  }, []);
  const catalogSettled = catalog.status === "ready" || catalog.status === "error";
  useEffect(() => {
    const anchor = pendingAnchor.current;
    if (!catalogSettled || !anchor) return;
    pendingAnchor.current = null;
    if (Math.abs(window.scrollY - anchor.scrollY) <= 1) {
      document.getElementById(anchor.id)?.scrollIntoView();
    }
  }, [catalogSettled]);

  const index = (
    <Box component="ol" sx={{ m: 0, p: 0, listStyle: "none" }}>
      {DOCUMENTATION_SECTIONS.map((section) => {
        const isCurrent = section === currentSection;
        return (
          <li key={section}>
            <Link
              href={`#${section}`}
              underline="hover"
              aria-current={isCurrent ? "location" : undefined}
              sx={{
                display: "block",
                py: 0.875,
                px: 1.5,
                fontSize: 14,
                fontWeight: isCurrent ? 600 : 400,
                color: isCurrent ? colors.blue : colors.inkSecondary,
                borderLeft: `2px solid ${isCurrent ? colors.blue : colors.line}`,
                "&:hover": { color: colors.blue, borderColor: colors.blue },
              }}
            >
              {sectionTitle(content[section])}
            </Link>
          </li>
        );
      })}
    </Box>
  );

  return (
    <Box sx={{ backgroundColor: colors.background, color: colors.ink }}>
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

        {/* Each section is a stage page's card */}
        <Box
          sx={{ maxWidth: 880, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}
        >
          {DOCUMENTATION_SECTIONS.map((section) => {
            const formerAnchor = FORMER_SECTION_ANCHORS[section];
            return (
              <Box
                key={section}
                component="section"
                id={section}
                sx={{
                  ...STAGE_CARD,
                  padding: { xs: "20px 16px", md: "28px 32px" },
                  scrollMarginTop: SCROLL_MARGIN_TOP,
                }}
              >
                {formerAnchor && (
                  <Box
                    component="span"
                    id={formerAnchor}
                    sx={{ display: "block", scrollMarginTop: SCROLL_MARGIN_TOP }}
                  />
                )}
                <DocumentationMarkdown icon={SECTION_ICONS[section]}>
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
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};
