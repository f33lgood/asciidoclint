import type { Rule } from "../types.js";
import { isLineComment, isLineInCommentParagraph, isLineInProtectedBlock } from "./utils.js";

export const AD040: Rule = {
  id: "AD040",
  alias: "html-link-text-residue",
  description: "Link text should not contain raw HTML or XML residue",
  tags: ["cleanup", "links", "conversion"],
  parser: "text",
  docs: {
    summary: "Visible link text should not contain raw HTML or XML fragments.",
    rationale: "Raw markup inside link text is escaped by Asciidoctor and becomes visible label text, which is usually conversion residue.",
    fixability: "no",
    fixHelper: "Keep only the intended human-readable link text and remove raw markup fragments from the label.",
    badExamples: [{ code: "link:https://example.com[++<span>Example</span>++]" }],
    goodExamples: [{ code: "link:https://example.com[Example]" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const lineNumber = index + 1;
        if (
          isLineComment(line)
          || isLineInProtectedBlock(document, file.file, lineNumber)
          || isLineInCommentParagraph(file.lines, index)
        ) {
          continue;
        }
        for (const match of linkLabelMarkupResidueMatches(line)) {
          onError({
            severity: "warning",
            message: "Link text should not contain raw HTML or XML residue",
            range: {
              start: { file: file.file, line: lineNumber, column: match.column },
              end: { file: file.file, line: lineNumber, column: match.endColumn },
            },
            fixHelper: "Keep only the intended human-readable link text and remove raw markup fragments from the label.",
          });
        }
      }
    }
  },
};

function linkLabelMarkupResidueMatches(line: string): Array<{ column: number; endColumn: number }> {
  const matches: Array<{ column: number; endColumn: number }> = [];
  const macroPattern = /\b(?:link|xref):[^\s[]+\[((?:[^\]\\]|\\.|\][^\s])*?)]/g;
  for (const macro of line.matchAll(macroPattern)) {
    if (macro.index === undefined) {
      continue;
    }
    const label = macro[1] ?? "";
    const markup = label.match(/\+{2,3}<\/?[A-Za-z][^>\]\n]*>\+{2,3}|<\/?[A-Za-z][^>\]\n]*>/);
    if (!markup || markup.index === undefined) {
      continue;
    }
    const column = macro.index + macro[0].indexOf(label) + markup.index + 1;
    matches.push({ column, endColumn: column + markup[0].length });
  }
  return matches;
}
