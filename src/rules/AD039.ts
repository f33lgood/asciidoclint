import type { Rule } from "../types.js";
import { isLineComment, isLineInCommentParagraph, isLineInProtectedBlock, isLineInTableBlock } from "./utils.js";

export const AD039: Rule = {
  id: "AD039",
  alias: "punctuation-passthrough-residue",
  description: "Safe punctuation passthrough residue should be removed",
  tags: ["cleanup", "conversion"],
  parser: "text",
  docs: {
    summary: "Inline passthrough wrappers around safe punctuation are usually conversion residue.",
    rationale: "AsciiDoc supports inline passthroughs, but wrappers around _, [, ], <, >, and | are common conversion residue when they appear in ordinary source text.",
    fixability: "safe",
    fixHelper: "Replace the passthrough-wrapped punctuation with the literal character when AD039 reports it.",
    badExamples: [{ code: "MODULE++_++ALPHA and MODULE++[++0-4++]++" }],
    goodExamples: [{ code: "MODULE_ALPHA and MODULE[0-4]" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const lineNumber = index + 1;
        if (isLineComment(line) || isLineInProtectedBlock(document, file.file, lineNumber) || isLineInCommentParagraph(file.lines, index)) {
          continue;
        }
        for (const match of line.matchAll(/\+\+([_[\]<>|])\+\+/g)) {
          const replacement = match[1] ?? "";
          if (
            (replacement === "|" && isLineInTableBlock(document, file.file, lineNumber))
            || (["[", "]"].includes(replacement) && isStandaloneBracketPassthroughLine(line))
          ) {
            continue;
          }
          const column = (match.index ?? 0) + 1;
          const endColumn = column + match[0].length;
          onError({
            severity: "warning",
            message: "Punctuation passthrough conversion residue should be removed",
            range: {
              start: { file: file.file, line: lineNumber, column },
              end: { file: file.file, line: lineNumber, column: endColumn },
            },
            fixHelper: `Replace ${match[0]} with ${replacement}.`,
            fix: {
              applicability: "safe",
              edits: [{
                file: file.file,
                range: {
                  start: { file: file.file, line: lineNumber, column },
                  end: { file: file.file, line: lineNumber, column: endColumn },
                },
                replacement,
              }],
            },
          });
        }
      }
    }
  },
};

function isStandaloneBracketPassthroughLine(line: string): boolean {
  return /^\s*\+\+\[\+\+[^+\n]*\+\+\]\+\+\s*$/.test(line);
}
