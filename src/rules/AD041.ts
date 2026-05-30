import type { Rule } from "../types.js";
import { isLineComment, isLineInCommentParagraph, isLineInProtectedBlock, isLineInTableBlock, listMarkerContent } from "./utils.js";

const spacedFormattingPatterns = [
  /(^|[^\w])([*_])\s+[^\d\s][^\n]*?\s+\2(?=\s|$|[.,;:!?])/,
  /(^|[^\w])([*_])\S[^\n]*?\s+\2(?=\s|$|[.,;:!?])/,
  /`\+\s+\S[^`]*?\s+\+`/,
];
const literalMonospacePatternIndex = 2;

export const AD041: Rule = {
  id: "AD041",
  alias: "no-space-in-inline-formatting",
  description: "Inline formatting markers should not contain inner spaces",
  tags: ["cleanup", "format", "inline"],
  parser: "text",
  docs: {
    summary: "Flag spaces just inside AsciiDoc emphasis, strong, or monospace markers.",
    rationale: "AsciiDoc inline formatting is delimiter-sensitive; inner spaces often leave the intended formatting markers visible in rendered output.",
    fixability: "no",
    fixHelper: "Move spaces outside constrained formatting markers, or use the correct unconstrained pair when spaces must remain inside the formatted span.",
    badExamples: [{ code: "This is * important * text and `+ code +` should be fixed." }],
    goodExamples: [{ code: "This is *important* text and `+code+` should be fixed." }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (isLineComment(line)
          || isLineInProtectedBlock(document, file.file, index + 1)
          || isLineInCommentParagraph(file.lines, index)
          || isLineInTableBlock(document, file.file, index + 1)) {
          continue;
        }
        const masked = maskRenderedInlineSpans(maskInlineMacroSpans(line));
        const content = listMarkerContent(masked);
        const matchEntry = spacedFormattingPatterns
          .map((pattern, patternIndex) => ({ match: content.content.match(pattern), patternIndex }))
          .find((entry) => entry.match?.index !== undefined);
        const match = matchEntry?.match;
        if (!match || match.index === undefined) {
          continue;
        }
        if (matchEntry.patternIndex !== literalMonospacePatternIndex && isLikelyFormulaText(match[0])) {
          continue;
        }
        onError({
          severity: "warning",
          message: "Inline formatting marker contains inner spaces",
          range: { start: { file: file.file, line: index + 1, column: content.offset + match.index + 1 } },
          fixHelper: "Move spaces outside the AsciiDoc formatting markers.",
        });
      }
    }
  },
};

function maskInlineMacroSpans(line: string): string {
  return line
    .replace(/`(?!\+)[^`]*`/g, (match) => "x".repeat(match.length))
    .replace(/\b[A-Za-z][A-Za-z0-9_-]*:\[[^\]]*]/g, (match) => "x".repeat(match.length));
}

function maskRenderedInlineSpans(line: string): string {
  return line
    .replace(/\*_[^\n]*?_\*/g, (match) => "x".repeat(match.length))
    .replace(/_\*[^\n]*?\*_/g, (match) => "x".repeat(match.length))
    .replace(/\*\*[^\n]*?\*\*/g, (match) => "x".repeat(match.length));
}

function isLikelyFormulaText(text: string): boolean {
  return /[=+\/~^]|\b(?:mod|div)\b|\d/.test(text);
}
