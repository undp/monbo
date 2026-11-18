import type { ReactNode } from "react";
import { vi } from "vitest";
import { Document, pdf, type DocumentProps } from "@react-pdf/renderer";
import { registerReportFonts } from "@/utils/report";
import { styles } from "@/utils/report/styles";
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
  box?: { top: number; height: number; paddingTop?: number };
  children?: LayoutNode[];
  lines?: { string: string; box: { y: number; height: number } }[];
}

/** Lays `pages` out with the report's fonts (Roboto), served from public/. */
export const layoutPages = async (pages: ReactNode): Promise<LayoutNode> => {
  vi.stubGlobal("fetch", async (url: string) => {
    const path = new URL(url).pathname.replace(/^\//, "");
    // No image is decoded: react-pdf's image decoding doesn't run in jsdom. Their
    // boxes are fixed by their style, so the layout is the same without them.
    if (path.startsWith("images/")) return new Response(null, { status: 404 });
    // The bytes themselves: in jsdom a Blob body reaches react-pdf as "[object Blob]"
    return new Response(readPublicFile(path) as BodyInit);
  });
  registerReportFonts();
  let layout: LayoutNode | undefined;
  // react-pdf hands its layout to onRender, outside its public types
  const onRender: DocumentProps["onRender"] = (params) => {
    layout = (params as { _INTERNAL__LAYOUT__DATA_?: LayoutNode })
      ._INTERNAL__LAYOUT__DATA_;
  };
  // react-pdf logs each image it can't decode: expected here, see above
  const isImageNoise = (args: unknown[]) =>
    /buffer bounds|image/i.test(args.map(String).join(" "));
  for (const level of ["error", "warn"] as const) {
    const original = console[level];
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      if (!isImageNoise(args)) original(...args);
    });
  }
  await pdf(
    // The report's font and letter spacing
    <Document onRender={onRender} style={styles.document}>
      {pages}
    </Document>
  ).toBlob();
  vi.mocked(console.error).mockRestore();
  vi.mocked(console.warn).mockRestore();
  if (!layout) throw new Error("react-pdf gave no layout");
  return layout;
};

/** Every printed line, with its page and its position on it. */
export const printedLines = (layout: LayoutNode): PrintedLine[] => {
  const lines: PrintedLine[] = [];
  const walk = (node: LayoutNode, page: number, offset: number) => {
    const top = offset + (node.box?.top ?? 0);
    // A text split across pages keeps its lines' y on the next page; react-pdf draws
    // them from the first one, under the text's top padding
    const textTop =
      top + (node.box?.paddingTop ?? 0) - (node.lines?.[0]?.box.y ?? 0);
    node.lines?.forEach((line) =>
      lines.push({
        page,
        text: line.string,
        top: textTop + line.box.y,
        bottom: textTop + line.box.y + line.box.height,
      })
    );
    node.children?.forEach((child) => walk(child, page, top));
  };
  layout.children?.forEach((page, index) => walk(page, index + 1, 0));
  return lines;
};
