"use client";

import { useMemo, type ReactNode } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Link,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkDirective from "remark-directive";
import { useTranslation } from "react-i18next";
import { isWebUrl } from "@/utils/layerCatalog";
import remarkDocumentationBlocks from "@/utils/remarkDocumentationBlocks";
import { alpha } from "@mui/material/styles";
import { PageEyebrow } from "@/components/page/flow/PageEyebrow";
import {
  FLOW_COLORS,
  HEADING_FONT,
  SECTION_ICON_TILE,
} from "@/components/page/flow/flowStyles";

// How the methodology page renders Markdown: its own sections, with their summary
// and "More detail" blocks, and the layers' considerations. No raw HTML: without
// rehype-raw, react-markdown shows an HTML tag as text.

const REMARK_PLUGINS = [remarkDirective, remarkDocumentationBlocks];

/** A section's "In short" box (`:::summary`). */
const SummaryBox: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  return (
    <Box
      component="aside"
      sx={{
        backgroundColor: FLOW_COLORS.blue25,
        border: `1px solid ${FLOW_COLORS.line}`,
        borderRadius: "12px",
        px: 3,
        pt: 2,
        pb: 0.5,
        mb: 3,
        "& ul": { mb: 1.5 },
        "& li::marker": { color: FLOW_COLORS.leafDark },
      }}
    >
      <PageEyebrow>{t("methodology:summary")}</PageEyebrow>
      {children}
    </Box>
  );
};

/** A collapsible "More detail" block (`:::details[label]`), closed at first. */
const DetailsBlock: React.FC<{ label: string; children: ReactNode }> = ({
  label,
  children,
}) => (
  <Accordion
    disableGutters
    elevation={0}
    sx={{
      border: `1px solid ${FLOW_COLORS.line}`,
      borderRadius: "12px",
      mb: 2,
      overflow: "hidden",
      "&::before": { display: "none" },
      "&.Mui-expanded": { borderColor: FLOW_COLORS.blueLine },
    }}
  >
    <AccordionSummary
      expandIcon={<ExpandMoreIcon sx={{ color: FLOW_COLORS.blue }} />}
      sx={{ "&:hover": { backgroundColor: FLOW_COLORS.blue25 } }}
    >
      <Typography sx={{ fontWeight: 600, color: FLOW_COLORS.ink }}>{label}</Typography>
    </AccordionSummary>
    <AccordionDetails sx={{ pt: 0 }}>{children}</AccordionDetails>
  </Accordion>
);

/** A section's title: the heading font, as the stage pages' titles. */
const SECTION_HEADING = {
  fontFamily: HEADING_FONT,
  fontSize: { xs: 24, md: 28 },
  fontWeight: 700,
  lineHeight: 1.2,
  letterSpacing: "-0.02em",
  color: FLOW_COLORS.ink,
  m: 0,
} as const;

const LINK = { color: FLOW_COLORS.blue, textDecorationColor: alpha(FLOW_COLORS.blue, 0.4) } as const;

const markdownComponents: Components = {
  // remarkDocumentationBlocks marks the summary and details blocks.
  div: ({ node, children, ...props }) => {
    const block = node?.properties?.dataBlock;
    if (block === "summary") return <SummaryBox>{children}</SummaryBox>;
    if (block === "details") {
      return (
        <DetailsBlock label={String(node?.properties?.dataLabel ?? "")}>
          {children}
        </DetailsBlock>
      );
    }
    return <div {...props}>{children}</div>;
  },
  h2: ({ children }) => (
    <Typography variant="h2" sx={{ ...SECTION_HEADING, mb: 2 }}>
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography
      variant="h3"
      sx={{
        fontFamily: HEADING_FONT,
        fontSize: 19,
        fontWeight: 700,
        lineHeight: 1.3,
        letterSpacing: "-0.01em",
        color: FLOW_COLORS.ink,
        mt: 4,
        mb: 1.5,
      }}
    >
      {children}
    </Typography>
  ),
  p: ({ children }) => (
    <Typography variant="body1" component="div" sx={{ mb: 2, color: FLOW_COLORS.ink2 }}>
      {children}
    </Typography>
  ),
  ul: ({ children }) => (
    <Box
      component="ul"
      sx={{ pl: 3, mt: 0, mb: 2, typography: "body1", color: FLOW_COLORS.ink2 }}
    >
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
        backgroundColor: FLOW_COLORS.blue25,
        border: `1px solid ${FLOW_COLORS.line}`,
        borderLeft: `3px solid ${FLOW_COLORS.blue}`,
        borderRadius: "8px",
        px: 2,
        py: 1.5,
        mt: 0,
        mb: 2,
        overflowX: "auto",
        fontSize: 14.5,
        color: FLOW_COLORS.ink,
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
        sx={LINK}
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
        borderRadius: 12,
        border: `1px solid ${FLOW_COLORS.line}`,
      }}
    />
  ),
};

/**
 * A section of the page, from its Markdown file. With an `icon`, the section's
 * title gets it in a tinted tile, as a stage page's section heading.
 */
export const DocumentationMarkdown: React.FC<{ children: string; icon?: ReactNode }> = ({
  children,
  icon,
}) => {
  const components = useMemo<Components>(
    () =>
      icon
        ? {
            ...markdownComponents,
            h2: ({ children: title }) => (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
                <Box aria-hidden sx={SECTION_ICON_TILE}>
                  {icon}
                </Box>
                <Typography variant="h2" sx={SECTION_HEADING}>
                  {title}
                </Typography>
              </Box>
            ),
          }
        : markdownComponents,
    [icon]
  );
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
      {children}
    </ReactMarkdown>
  );
};

// A layer's considerations sit inside a section, under its layer: every heading
// is a small one, and images aren't shown (their size and source are unknown).
const ConsiderationHeading = ({ children }: { children?: ReactNode }) => (
  <Typography
    variant="h4"
    component="h4"
    sx={{ fontWeight: 700, fontSize: 15, mt: 2, mb: 1, color: FLOW_COLORS.ink }}
  >
    {children}
  </Typography>
);

const considerationComponents: Components = {
  ...markdownComponents,
  h1: ConsiderationHeading,
  h2: ConsiderationHeading,
  h3: ConsiderationHeading,
  h4: ConsiderationHeading,
  h5: ConsiderationHeading,
  h6: ConsiderationHeading,
  p: ({ children }) => (
    <Typography variant="body2" component="div" sx={{ mb: 1.5, color: FLOW_COLORS.ink2 }}>
      {children}
    </Typography>
  ),
  img: () => null,
  // Written by a country's admin: only web addresses are links (see isWebUrl).
  a: ({ href, children }) =>
    isWebUrl(href) ? (
      <Link href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </Link>
    ) : (
      <span>{children}</span>
    ),
};

/** A layer's considerations, as its country wrote them. */
export const ConsiderationsMarkdown: React.FC<{ children: string }> = ({ children }) => (
  <ReactMarkdown components={considerationComponents}>{children}</ReactMarkdown>
);
