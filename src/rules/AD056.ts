import type { Rule, Severity } from "../types.js";
import { isAsciiDocSectionTitleLine, isLineInProtectedBlock } from "./utils.js";

const orderedListStylePattern = /^\s*\[(?:arabic|decimal|loweralpha|upperalpha|lowerroman|upperroman)(?:,[^\]]*)?]\s*$/i;
const blankListItemPattern = /^\s*\.{1,}\s+\{(?:blank|empty)}\s*$/i;

export const AD056: Rule = {
  id: "AD056",
  alias: "dangling-blank-list-continuation",
  description: "Blank list continuations should not capture following content",
  tags: ["structure", "conversion", "docx", "list"],
  parser: "text",
  docs: {
    summary: "A styled ordered list containing only a blank item and continuation marker should not capture following blocks.",
    rationale: "A conversion residue sequence such as [arabic], . {blank}, and + can attach the following block to an empty list item. If the following block is a section title, Asciidoctor renders the heading marker as paragraph text instead of creating a section.",
    fixability: "no",
    fixHelper: "Remove the list style line, blank list item, and continuation marker unless an intentional empty list item is required. If the following block should be a section, make sure the heading starts outside any list continuation.",
    badExamples: [{ code: "[arabic]\n.. {blank}\n+\n\n== Next section" }],
    goodExamples: [{ code: "== Next section\n\nParagraph." }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (let index = 0; index < file.lines.length - 2; index += 1) {
        if (
          !orderedListStylePattern.test(file.lines[index] ?? "")
          || !blankListItemPattern.test(file.lines[index + 1] ?? "")
          || (file.lines[index + 2] ?? "").trim() !== "+"
          || isLineInProtectedBlock(document, file.file, index + 1)
        ) {
          continue;
        }

        const next = nextNonblankLine(file.lines, index + 3);
        const severity: Severity = next && isAsciiDocSectionTitleLine(next.line) ? "error" : "warning";
        onError({
          severity,
          message: severity === "error"
            ? "Blank list continuation captures a following section heading"
            : "Blank list continuation appears to be conversion residue",
          range: { start: { file: file.file, line: index + 1, column: 1 } },
          fixHelper: "Remove the list style line, blank list item, and continuation marker unless an intentional empty list item is required.",
        });
      }
    }
  },
};

function nextNonblankLine(lines: string[], startIndex: number): { line: string; index: number } | undefined {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() !== "") {
      return { line, index };
    }
  }
  return undefined;
}
