import type { ReactNode } from "react";
import { vi } from "vitest";
import { Document, pdf, type DocumentProps } from "@react-pdf/renderer";
import { registerReportFonts } from "@/utils/deforestationReport";
import { readPublicFile } from "./files";

// The report's pages as react-pdf lays them out: where each printed line lands, page
// by page. A real layout (fonts, line breaks, page breaks), without reading the PDF:
// react-pdf hands its layout to the document's `onRender`.

export interface PrintedLine {
  page: number;
  text: string;
  /** From the top of the page, in points. */
  top: number;
  bottom: number;
}

interface LayoutNode {
  box?: { top: number; height: number };
  children?: LayoutNode[];
  lines?: { string: string; box: { y: number; height: number } }[];
}

// Any image of the pages is served as this JPEG: their boxes are fixed by their
// style, so the layout doesn't depend on it (and PNG decoding needs a real browser).
const ANY_IMAGE = "images/aerial-river-rainforest.jpg";

/** Lays `pages` out with the report's fonts, served from public/. */
export const layoutPages = async (pages: ReactNode): Promise<LayoutNode> => {
  vi.stubGlobal("fetch", async (url: string) => {
    const path = new URL(url).pathname.replace(/^\//, "");
    const bytes = readPublicFile(path.startsWith("images/") ? ANY_IMAGE : path);
    return new Response(new Blob([bytes as BlobPart]));
  });
  registerReportFonts();
  let layout: LayoutNode | undefined;
  // react-pdf hands its layout to onRender, outside its public types
  const onRender: DocumentProps["onRender"] = (params) => {
    layout = (params as { _INTERNAL__LAYOUT__DATA_?: LayoutNode })
      ._INTERNAL__LAYOUT__DATA_;
  };
  await pdf(
    <Document onRender={onRender}>
      {pages}
    </Document>
  ).toBlob();
  if (!layout) throw new Error("react-pdf gave no layout");
  return layout;
};

/** Every printed line, with its page and its position on it. */
export const printedLines = (layout: LayoutNode): PrintedLine[] => {
  const lines: PrintedLine[] = [];
  const walk = (node: LayoutNode, page: number, offset: number) => {
    const top = offset + (node.box?.top ?? 0);
    node.lines?.forEach((line) =>
      lines.push({
        page,
        text: line.string,
        top: top + line.box.y,
        bottom: top + line.box.y + line.box.height,
      })
    );
    node.children?.forEach((child) => walk(child, page, top));
  };
  layout.children?.forEach((page, index) => walk(page, index + 1, 0));
  return lines;
};
