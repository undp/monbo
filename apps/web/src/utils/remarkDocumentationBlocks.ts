import type { Paragraph, Parent, Root, RootContent, Text } from "mdast";
// Its types add the directive nodes to mdast's.
import type {} from "remark-directive";

// The documentation page's Markdown marks two kinds of block with remark-directive:
//
//   :::summary            the section's "In short" box
//   :::details[Label]     a collapsible "More detail" block, closed by default
//
// This plugin, run after remark-directive, turns each into a <div data-block=…>
// that MethodologyDocument renders. Text and leaf directives are never meant as
// such: remark-directive also reads "10:30" or "EPSG:4326" as a text directive, so
// they go back to the text they were written as.

type ContainerDirective = Extract<RootContent, { type: "containerDirective" }>;

// The file being processed: only its source is read.
type SourceFile = { value: unknown };

export const DOCUMENTATION_BLOCKS = ["summary", "details"] as const;

export type DocumentationBlock = (typeof DOCUMENTATION_BLOCKS)[number];

/** The plain text of a node and its children (a details block's label). */
const plainText = (node: RootContent | Root): string =>
  "value" in node
    ? node.value
    : "children" in node
      ? node.children.map(plainText).join("")
      : "";

const isLabel = (node: RootContent): node is Paragraph =>
  node.type === "paragraph" && node.data?.directiveLabel === true;

/** The source a node was parsed from, or `fallback` when it has no position. */
const sourceOf = (node: RootContent, file: SourceFile, fallback: string): string => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined
    ? fallback
    : String(file.value).slice(start, end);
};

const markBlock = (node: ContainerDirective) => {
  if (!(DOCUMENTATION_BLOCKS as readonly string[]).includes(node.name)) return;
  const label = node.children.find(isLabel);
  node.children = node.children.filter((child) => !isLabel(child));
  node.data = {
    ...node.data,
    hName: "div",
    hProperties: {
      dataBlock: node.name,
      ...(label ? { dataLabel: plainText(label).trim() } : {}),
    },
  };
};

const restore = (parent: Parent, file: SourceFile) => {
  parent.children = parent.children.map((child) => {
    if (child.type === "textDirective") {
      const text: Text = {
        type: "text",
        value: sourceOf(child, file, `:${child.name}`),
      };
      return text;
    }
    if (child.type === "leafDirective") {
      const paragraph: Paragraph = {
        type: "paragraph",
        children: [{ type: "text", value: sourceOf(child, file, `::${child.name}`) }],
      };
      return paragraph;
    }
    if (child.type === "containerDirective") markBlock(child);
    if ("children" in child) restore(child, file);
    return child;
  }) as typeof parent.children;
};

export default function remarkDocumentationBlocks() {
  return (tree: Root, file: SourceFile) => {
    restore(tree, file);
  };
}
