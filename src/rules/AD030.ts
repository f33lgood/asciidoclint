import type { Rule } from "../types.js";
import { isLineInProtectedBlock, isLineInTableBlock } from "./utils.js";

export const AD030: Rule = {
  id: "AD030",
  alias: "markdown-table-residue",
  description: "Markdown pipe table residue should not render as text",
  tags: ["conversion", "table"],
  parser: "text",
  docs: {
    summary: "Flag Markdown pipe table separator lines that Asciidoctor renders as paragraph text.",
    rationale: "Asciidoctor documents Markdown-compatible headings, fenced code blocks, blockquotes, and thematic breaks, but not Markdown pipe tables. Converted Markdown tables often appear table-like in source while rendering as plain paragraphs.",
    fixability: "no",
    fixHelper: "Rewrite the Markdown pipe table as an AsciiDoc table delimited by |=== and verify column structure manually.",
    badExamples: [{ code: "| A | B |\n|---|---|" }],
    goodExamples: [{ code: "|===\n| A | B\n|===" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (
          !/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
          || isLineInProtectedBlock(document, file.file, index + 1)
          || isLineInTableBlock(document, file.file, index + 1)
        ) {
          continue;
        }
        onError({
          severity: "warning",
          message: "Markdown pipe table separator renders as text in AsciiDoc",
          range: { start: { file: file.file, line: index + 1, column: 1 } },
          fixHelper: "Rewrite this as an AsciiDoc table delimited by |===.",
        });
      }
    }
  },
};
