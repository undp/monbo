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

/**
 * Whether line `index` must stay on the same page as the next non-empty line: a
 * heading, or a list item that opens a sublist (the next line is indented deeper, or
 * the item ends in ":").
 */
const keepsWithNext = (lines: string[], index: number): boolean => {
  const line = lines[index];
  if (line.trim().startsWith("### ")) return true;
  if (!isListLine(line)) return false;
  const next = lines.slice(index + 1).find((l) => l.trim() !== "");
  return (
    line.trim().endsWith(":") ||
    (next !== undefined && leadingSpaces(next) > leadingSpaces(line))
  );
};

/**
 * A layer's considerations. A heading, or an item that opens a sublist, goes in one
 * unbreakable block with the line it introduces, so it never ends a page alone; so
 * does `title` (the section's title) with the first block.
 */
export const Considerations = ({
  considerations,
  title,
}: {
  considerations: string;
  title?: React.ReactNode;
}) => {
  const lines = considerations.split("\n");
  // Each block: the line indexes that must stay on one page
  const blocks: number[][] = [];
  for (let i = 0; i < lines.length; i++) {
    let end = i;
    // Up to the next non-empty line, and on while that one also keeps with its next
    while (end < lines.length - 1 && keepsWithNext(lines, end)) {
      end++;
      while (end < lines.length - 1 && lines[end].trim() === "") end++;
    }
    blocks.push(Array.from({ length: end - i + 1 }, (_, k) => i + k));
    i = end;
  }
  return (
    <>
      {blocks.map((block, b) => {
        const nodes = block.map((index) => renderLine(lines[index], index));
        const withTitle = b === 0 && title !== undefined;
        if (block.length === 1 && !withTitle) return nodes[0];
        return (
          <View key={`block-${block[0]}`} wrap={false}>
            {withTitle && title}
            {nodes}
          </View>
        );
      })}
    </>
  );
};

/** One markdown line as a react-pdf element. */
const renderLine = (line: string, index: number) => {
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
        // A bullet never stays alone at the bottom of a page
        wrap={false}
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
