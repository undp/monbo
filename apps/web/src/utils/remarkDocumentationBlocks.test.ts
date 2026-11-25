import type { Root } from "mdast";
import remarkDirective from "remark-directive";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import remarkDocumentationBlocks from "./remarkDocumentationBlocks";

const transform = async (markdown: string): Promise<Root> => {
  const processor = unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkDocumentationBlocks);
  return (await processor.run(processor.parse(markdown), markdown)) as Root;
};

describe("remarkDocumentationBlocks", () => {
  it("marks a summary block", async () => {
    const tree = await transform(":::summary\n- One point\n:::\n");

    const [block] = tree.children;
    expect(block.data).toMatchObject({
      hName: "div",
      hProperties: { dataBlock: "summary" },
    });
  });

  it("marks a details block with its label, taken out of its content", async () => {
    const tree = await transform(":::details[More **detail**: Gauss]\nThe text.\n:::\n");

    const [block] = tree.children;
    expect(block.data).toMatchObject({
      hName: "div",
      hProperties: { dataBlock: "details", dataLabel: "More detail: Gauss" },
    });
    const children = block.type === "containerDirective" ? block.children : [];
    expect(children).toHaveLength(1);
    expect(JSON.stringify(children)).not.toContain("More");
  });

  it("writes text directives back as the text they came from", async () => {
    const source = "At 10:30, in EPSG:4326, the ratio:value is kept.";
    const tree = await transform(source);

    const [paragraph] = tree.children;
    const text =
      paragraph.type === "paragraph"
        ? paragraph.children.map((child) => ("value" in child ? child.value : "")).join("")
        : "";
    expect(text).toBe(source);
  });

  it("writes a leaf directive back as a paragraph", async () => {
    const tree = await transform("::note[Hi]\n");

    expect(tree.children).toEqual([
      expect.objectContaining({
        type: "paragraph",
        children: [expect.objectContaining({ type: "text", value: "::note[Hi]" })],
      }),
    ]);
  });

  it("leaves an unknown container directive unmarked", async () => {
    const tree = await transform(":::warning\nCareful.\n:::\n");

    expect(tree.children[0].data).toBeUndefined();
  });
});
