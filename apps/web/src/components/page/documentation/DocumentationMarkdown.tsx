"use client";

import type { ReactNode } from "react";
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
        backgroundColor: "#F3FAFD",
        border: "1px solid #CDE6F3",
        borderRadius: 2,
        px: 3,
        pt: 2,
        pb: 0.5,
        mb: 3,
        "& ul": { mb: 1.5 },
      }}
    >
      <Typography variant="h4" component="p" sx={{ fontWeight: 500, mb: 1 }}>
        {t("methodology:summary")}
      </Typography>
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
      border: "1px solid #E0E0E0",
      borderRadius: 2,
      mb: 2,
      "&::before": { display: "none" },
    }}
  >
    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
      <Typography sx={{ fontWeight: 500 }}>{label}</Typography>
    </AccordionSummary>
    <AccordionDetails sx={{ pt: 0 }}>{children}</AccordionDetails>
  </Accordion>
);

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

/** A section of the page, from its Markdown file. */
export const DocumentationMarkdown: React.FC<{ children: string }> = ({ children }) => (
  <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={markdownComponents}>
    {children}
  </ReactMarkdown>
);

// A layer's considerations sit inside a section, under its layer: every heading
// is a small one, and images aren't shown (their size and source are unknown).
const ConsiderationHeading = ({ children }: { children?: ReactNode }) => (
  <Typography variant="h4" component="h4" sx={{ fontWeight: 600, fontSize: 15, mt: 2, mb: 1 }}>
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
    <Typography variant="body2" component="div" sx={{ mb: 1.5 }}>
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
