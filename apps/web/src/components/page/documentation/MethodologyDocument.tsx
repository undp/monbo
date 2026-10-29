"use client";

import { Fragment } from "react";
import { Box, Divider, Link, Typography } from "@mui/material";
import ReactMarkdown, { type Components } from "react-markdown";
import { useTranslation } from "react-i18next";
import {
  DOCUMENTATION_SECTIONS,
  fillDocumentationPlaceholders,
  sectionTitle,
  type DocumentationContent,
} from "@/utils/documentation";

// The fixed header's height plus some air, so an anchor doesn't leave its heading
// under the header.
const SCROLL_MARGIN_TOP = 80;

const markdownComponents: Components = {
  h2: ({ children }) => (
    <Typography
      variant="h2"
      sx={{ fontSize: 28, fontWeight: 500, lineHeight: "38px", mb: 2 }}
    >
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography variant="h3" sx={{ fontWeight: 500, mt: 4, mb: 1.5 }}>
      {children}
    </Typography>
  ),
  p: ({ children }) => (
    <Typography variant="body1" component="div" sx={{ mb: 2 }}>
      {children}
    </Typography>
  ),
  ul: ({ children }) => (
    <Box component="ul" sx={{ pl: 3, mt: 0, mb: 2, typography: "body1" }}>
      {children}
    </Box>
  ),
  li: ({ children }) => (
    <Box component="li" sx={{ mb: 1 }}>
      {children}
    </Box>
  ),
  // Fenced blocks hold the formulas: plain text, set apart.
  pre: ({ children }) => (
    <Box
      component="pre"
      sx={{
        backgroundColor: "#F3FAFD",
        borderLeft: "3px solid #03689E",
        borderRadius: 1,
        px: 2,
        py: 1.5,
        mt: 0,
        mb: 2,
        overflowX: "auto",
        fontSize: 15,
        whiteSpace: "pre-wrap",
      }}
    >
      {children}
    </Box>
  ),
  a: ({ href, children }) => {
    const external = href?.startsWith("http");
    return (
      <Link
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </Link>
    );
  },
  img: ({ src, alt }) => (
    // A plain <img>: the Markdown gives no size for next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : undefined}
      alt={alt ?? ""}
      style={{
        display: "block",
        width: "100%",
        maxWidth: 480,
        height: "auto",
        borderRadius: 8,
        border: "1px solid #E0E0E0",
      }}
    />
  ),
};

/**
 * The documentation page's body: an index and one section per Markdown file,
 * with the deployment's thresholds filled in.
 */
export const MethodologyDocument: React.FC<{ content: DocumentationContent }> = ({
  content,
}) => {
  const { t, i18n } = useTranslation();

  return (
    <Box sx={{ maxWidth: 880, mx: "auto", px: 3, pt: 5, pb: 10, color: "#3A3541" }}>
      <Typography
        variant="h1"
        sx={{ fontSize: 34, fontWeight: 500, lineHeight: "47px", mb: 1 }}
      >
        {t("common:documentation:title")}
      </Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
        {t("common:documentation:subtitle")}
      </Typography>

      <Box
        component="nav"
        aria-label={t("common:documentation:contents")}
        sx={{
          border: "1px solid #E0E0E0",
          borderRadius: 2,
          backgroundColor: "white",
          px: 3,
          py: 2,
          mb: 6,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 500, mb: 1 }}>
          {t("common:documentation:contents")}
        </Typography>
        <Box component="ol" sx={{ m: 0, pl: 3 }}>
          {DOCUMENTATION_SECTIONS.map((section) => (
            <li key={section}>
              <Link href={`#${section}`}>{sectionTitle(content[section])}</Link>
            </li>
          ))}
        </Box>
      </Box>

      {DOCUMENTATION_SECTIONS.map((section, index) => (
        <Fragment key={section}>
          {index > 0 && <Divider sx={{ my: 6 }} />}
          <Box
            component="section"
            id={section}
            sx={{ scrollMarginTop: SCROLL_MARGIN_TOP }}
          >
            <ReactMarkdown components={markdownComponents}>
              {fillDocumentationPlaceholders(content[section], i18n.language)}
            </ReactMarkdown>
          </Box>
        </Fragment>
      ))}
    </Box>
  );
};
