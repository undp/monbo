import { Text, View } from "@react-pdf/renderer";

// A layer's considerations (markdown: ### headings, - and 1. lists, **bold** and
// _italic_) as react-pdf elements: the report can't use react-markdown.

interface Segment {
  text: string;
  isBold: boolean;
  isItalic: boolean;
}

const leadingSpaces = (line: string) => line.match(/^(\s*)/)?.[1]?.length ?? 0;
const isListLine = (line: string) =>
  line.trim().startsWith("- ") || /^\d+\./.test(line.trim());
const isHeadingLine = (line: string) => line.trim().startsWith("### ");

// What may go in an unbreakable block. react-pdf can't move a block taller than a
// page to the next one: it prints it where it is and cuts it off, so text is lost.
// A page holds about 2,800 characters of considerations (and an admin may write up
// to 20,000), so only what is short by construction is ever kept whole.
/** A line this short (about 7 lines in print) may be kept whole. */
const SHORT_LINE_CHARS = 600;
/** An unbreakable block (with the section's title) stays well under a page. */
const MAX_BLOCK_CHARS = 1500;
/**
 * And at most this many lines: short lines add height too (an empty one is drawn
 * with its margin), and a page holds about 30.
 */
const MAX_BLOCK_LINES = 12;

/**
 * What must fit under a line that introduces another, in points: two lines of
 * considerations (23 pt each, see appendixPageBodyText) and their margins. react-pdf
 * moves a paragraph with fewer than two lines left on the page (its orphans), so a
 * smaller presence would let the heading stay alone at the bottom.
 */
const KEEP_AHEAD = 60;

const isShort = (line: string) => line.trim().length <= SHORT_LINE_CHARS;

/** The index of the next non-empty line after `index`, or -1. */
const nextLineIndex = (lines: string[], index: number) =>
  lines.findIndex((line, i) => i > index && line.trim() !== "");

/**
 * Whether line `index` introduces the next non-empty line: a heading, or a list
 * item that opens a sublist (the next line is indented deeper, or the item ends in
 * ":"). It must not end a page alone.
 */
const introducesNext = (lines: string[], index: number): boolean => {
  const line = lines[index];
  const next = nextLineIndex(lines, index);
  if (next === -1) return false;
  if (isHeadingLine(line)) return true;
  return (
    isListLine(line) &&
    (line.trim().endsWith(":") || leadingSpaces(lines[next]) > leadingSpaces(line))
  );
};

/**
 * A layer's considerations. A heading, or an item that opens a sublist, never ends a
 * page alone, and neither does `title` (the section's title):
 * - when what follows is short, they go in one unbreakable block with it;
 * - when it is long (a paragraph can be longer than a page), they only ask react-pdf
 *   to keep the beginning of it on the same page (`minPresenceAhead`), and the long
 *   line breaks across pages as any text does.
 */
export const Considerations = ({
  considerations,
  title,
}: {
  considerations: string;
  title?: React.ReactNode;
}) => {
  // A run of empty lines reads as one, as in markdown: it would only add height
  const lines = considerations
    .split("\n")
    .filter((line, i, all) => line.trim() !== "" || all[i - 1]?.trim() !== "");
  // Each block: the line indexes that go together on one page
  const blocks: number[][] = [];
  for (let i = 0; i < lines.length; i++) {
    const block = [i];
    let chars = lines[i].trim().length;
    let last = i;
    // On to the next non-empty line while the last one introduces it and the block
    // stays short; empty lines in between go with it.
    while (isShort(lines[last]) && introducesNext(lines, last)) {
      const next = nextLineIndex(lines, last);
      chars += lines[next].trim().length;
      if (
        !isShort(lines[next]) ||
        chars > MAX_BLOCK_CHARS ||
        next - i + 1 > MAX_BLOCK_LINES
      )
        break;
      for (let k = last + 1; k <= next; k++) block.push(k);
      last = next;
    }
    blocks.push(block);
    i = last;
  }
  // The title joins the first block when that block is unbreakable and short
  const firstBlockChars = (blocks[0] ?? []).reduce(
    (sum, index) => sum + lines[index].trim().length,
    0
  );
  const titleJoinsFirst =
    title !== undefined &&
    firstBlockChars <= MAX_BLOCK_CHARS &&
    (blocks[0]?.length ?? 0) < MAX_BLOCK_LINES &&
    (blocks[0] ?? []).every((index) => isShort(lines[index]));
  return (
    <>
      {title !== undefined && !titleJoinsFirst && (
        // Keeps the beginning of the first line under it on the same page
        <View minPresenceAhead={KEEP_AHEAD}>{title}</View>
      )}
      {blocks.map((block, b) => {
        const last = block[block.length - 1];
        // A line that introduces a long one: keep its beginning on the same page
        const keepAhead = introducesNext(lines, last);
        const withTitle = b === 0 && titleJoinsFirst;
        if (block.length === 1 && !withTitle)
          return renderLine(lines[last], last, keepAhead);
        const nodes = block.map((index) => renderLine(lines[index], index));
        return (
          <View
            key={`block-${block[0]}`}
            wrap={false}
            minPresenceAhead={keepAhead ? KEEP_AHEAD : undefined}
          >
            {withTitle && title}
            {nodes}
          </View>
        );
      })}
    </>
  );
};

/**
 * One markdown line as a react-pdf element. `keepAhead`: the line introduces a long
 * one, whose beginning must stay on the same page.
 */
const renderLine = (line: string, index: number, keepAhead = false) => {
  // TODO: refactor to simplify or modularize this
  // Check if the line is a heading (starts with ###)
  const isHeading = line.trim().startsWith("### ");

  // Check indentation level for list items
  const indentationLevel = Math.floor(leadingSpaces(line) / 2); // Assuming 2 spaces per indentation level

  // Check if the line is a list item
  const isListItem =
    line.trim().startsWith("- ") || line.trim().match(/^\d+\./);

  // Process content based on type
  let content = line;
  if (isHeading) {
    content = line.trim().replace(/^### /, "");
  } else if (isListItem) {
    content = line
      .trim()
      .replace(/^- /, "")
      .replace(/^\d+\./, "");
  }

  // Function to process formatting (bold and italic)
  const renderFormattedText = (text: string) => {
    // Split the text by bold and italic markers
    const segments: Segment[] = [];
    // let currentText = text;

    // Process bold text (surrounded by **)
    let boldMatch;
    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;

    while ((boldMatch = boldRegex.exec(text)) !== null) {
      // Add text before the bold section
      if (boldMatch.index > lastIndex) {
        segments.push({
          text: text.substring(lastIndex, boldMatch.index),
          isBold: false,
          isItalic: false,
        });
      }

      // Add the bold text
      segments.push({
        text: boldMatch[1], // The text inside ** markers
        isBold: true,
        isItalic: false,
      });

      lastIndex = boldMatch.index + boldMatch[0].length;
    }

    // Add any remaining text
    if (lastIndex < text.length) {
      segments.push({
        text: text.substring(lastIndex),
        isBold: false,
        isItalic: false,
      });
    }

    // If no bold text was found, just use the original text
    if (segments.length === 0) {
      segments.push({
        text: text,
        isBold: false,
        isItalic: false,
      });
    }

    // Process each segment for italic text (surrounded by _)
    const finalSegments: Segment[] = [];
    segments.forEach((segment) => {
      const italicRegex = /_(.*?)_/g;
      let italicMatch;
      let italicLastIndex = 0;
      const italicSegments: Segment[] = [];

      while (
        (italicMatch = italicRegex.exec(segment.text)) !== null
      ) {
        // Add text before the italic section
        if (italicMatch.index > italicLastIndex) {
          italicSegments.push({
            text: segment.text.substring(
              italicLastIndex,
              italicMatch.index
            ),
            isBold: segment.isBold,
            isItalic: false,
          });
        }

        // Add the italic text
        italicSegments.push({
          text: italicMatch[1], // The text inside _ markers
          isBold: segment.isBold,
          isItalic: true,
        });

        italicLastIndex =
          italicMatch.index + italicMatch[0].length;
      }

      // Add any remaining text
      if (italicLastIndex < segment.text.length) {
        italicSegments.push({
          text: segment.text.substring(italicLastIndex),
          isBold: segment.isBold,
          isItalic: false,
        });
      }

      // If no italic text was found, just use the original segment
      if (italicSegments.length === 0) {
        italicSegments.push(segment);
      }

      finalSegments.push(...italicSegments);
    });

    // Render all segments with appropriate styling. A plain segment inherits
    // its line's style, so a heading's segments stay bold.
    return finalSegments.map((segment, i) => (
      <Text
        key={i}
        style={{
          ...(segment.isBold ? { fontWeight: "bold" } : {}),
          ...(segment.isItalic ? { fontStyle: "italic" } : {}),
        }}
      >
        {segment.text}
      </Text>
    ));
  };

  if (isHeading) {
    // Render headings with appropriate style
    return (
      <Text
        key={index}
        minPresenceAhead={keepAhead ? KEEP_AHEAD : undefined}
        style={{
          fontWeight: 700,
          fontSize: 12,
          marginTop: 8,
          marginBottom: 5,
        }}
      >
        {renderFormattedText(content)}
      </Text>
    );
  } else if (isListItem) {
    // Render list items with proper indentation
    return (
      <View
        key={index}
        // A short item never breaks, so its bullet never stays alone at the bottom of
        // a page; a long one breaks as any text does (it may not fit a page)
        wrap={!isShort(line)}
        minPresenceAhead={keepAhead ? KEEP_AHEAD : undefined}
        style={{
          flexDirection: "row",
          marginBottom: 3,
          paddingLeft: indentationLevel * 15, // Indent based on level
        }}
      >
        <Text style={{ width: 15, marginRight: 5 }}>
          {line.trim().startsWith("- ")
            ? "•"
            : line.trim().match(/^\d+\./)?.[0]
            ? line.trim().match(/^\d+\./)?.[0]
            : "•"}
        </Text>
        <Text style={{ flex: 1 }}>
          {renderFormattedText(content)}
        </Text>
      </View>
    );
  } else {
    // Render regular paragraphs
    return (
      <Text key={index} style={{ marginBottom: 5 }}>
        {renderFormattedText(content)}
      </Text>
    );
  }
};
