import { isValidElement, type ReactNode } from "react";

// The report's react-pdf element tree, without rendering a PDF (no fonts, no
// layout): its components are expanded into react-pdf's primitives ("PAGE",
// "VIEW", "TEXT", "LINK", "IMAGE"…), so a test can read what each page says.
// The report's components are pure functions of their props (no hooks).

export interface PdfNode {
  type: string;
  props: Record<string, unknown>;
  children: (PdfNode | string)[];
}

const expand = (node: ReactNode): (PdfNode | string)[] => {
  if (node === null || node === undefined || typeof node === "boolean")
    return [];
  if (typeof node === "string" || typeof node === "number")
    return [String(node)];
  if (Array.isArray(node)) return node.flatMap(expand);
  if (!isValidElement(node)) return [];
  const { type } = node;
  const props = node.props as Record<string, unknown> & { children?: ReactNode };
  if (typeof type === "function")
    return expand((type as (p: unknown) => ReactNode)(props));
  if (typeof type !== "string") return expand(props.children); // fragments
  return [{ type, props, children: expand(props.children) }];
};

/** The tree under `element` (a <Document>, a page or a list of pages). */
export const pdfTree = (element: ReactNode): (PdfNode | string)[] =>
  expand(element);

/** Every node of `type` in the tree, in order. */
export const findAll = (
  nodes: (PdfNode | string)[],
  type: string
): PdfNode[] =>
  nodes.flatMap((node) =>
    typeof node === "string"
      ? []
      : [...(node.type === type ? [node] : []), ...findAll(node.children, type)]
  );

/** The text of the tree, with a space between its text nodes. */
export const textOf = (nodes: (PdfNode | string)[]): string =>
  nodes
    .map((node) => (typeof node === "string" ? node : textOf(node.children)))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

/** The text of each page of a document's tree. */
export const pagesText = (element: ReactNode): string[] =>
  findAll(pdfTree(element), "PAGE").map((page) => textOf(page.children));
