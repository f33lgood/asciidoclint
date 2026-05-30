import type { Rule } from "../types.js";
import { isLineInProtectedBlock } from "./utils.js";

export const AD007: Rule = {
  id: "AD007",
  alias: "heading-depth-limit",
  description: "Section headings should not exceed Asciidoctor's supported depth",
  tags: ["core", "headings"],
  parser: "text",
  docs: {
    summary: "AsciiDoc section heading markers should stay within Asciidoctor's supported level range.",
    rationale: "Asciidoctor only recognizes section levels 0 through 5. Deeper heading-like lines render as paragraph text, so the intended section disappears from the document outline.",
    fixability: "no",
    fixHelper: "Reduce the heading marker to six or fewer = / # characters, or split the content into a separate document if the hierarchy is too deep.",
    badExamples: [{ code: "= Title\n\n======= Too Deep" }],
    goodExamples: [{ code: "= Title\n\n== Parent\n\n=== Child\n\n==== Level 3\n\n===== Level 4\n\n====== Deepest Supported" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (let index = 0; index < file.lines.length; index += 1) {
        const line = file.lines[index] ?? "";
        if (isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }
        const marker = unsupportedHeadingMarker(line);
        if (!marker) {
          continue;
        }
        onError({
          severity: "error",
          message: `Heading marker ${marker} exceeds Asciidoctor's supported section depth`,
          range: { start: { file: file.file, line: index + 1, column: 1 } },
          fixHelper: "Reduce the heading depth to level 5 or less, or split the content into a separate document.",
        });
      }
    }
  },
};

function unsupportedHeadingMarker(line: string): string | undefined {
  return line.match(/^(={7,}|#{7,})\s+\S/)?.[1];
}
