import type { Rule } from "../types.js";
import { isLineInProtectedBlock, isLineInTableBlock } from "./utils.js";

export const AD034: Rule = {
  id: "AD034",
  alias: "no-hard-tabs",
  description: "Lines should not contain hard tabs",
  tags: ["cleanup", "whitespace"],
  parser: "text",
  docs: {
    summary: "Use spaces instead of hard tab characters.",
    rationale: "Hard tabs in prose and structural markup render inconsistently across editors, terminals, and generated output.",
    fixability: "safe",
    fixHelper: "Replace hard tabs in prose or structural markup with spaces. Keep tabs inside TSV tables and protected/verbatim content when they are intentional data.",
    badExamples: [{ code: "*\tTabbed list item" }],
    goodExamples: [{ code: "* Tabbed list item" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const lineNumber = index + 1;
        if (
          !line.includes("\t")
          || isLineInProtectedBlock(document, file.file, lineNumber)
          || isLineInTableBlock(document, file.file, lineNumber)
        ) {
          continue;
        }
        for (const match of line.matchAll(/\t/g)) {
          const column = (match.index ?? 0) + 1;
          onError({
            severity: "warning",
            message: "Line contains a hard tab",
            range: {
              start: { file: file.file, line: lineNumber, column },
              end: { file: file.file, line: lineNumber, column: column + 1 },
            },
            fix: {
              applicability: "safe",
              edits: [{
                file: file.file,
                range: {
                  start: { file: file.file, line: lineNumber, column },
                  end: { file: file.file, line: lineNumber, column: column + 1 },
                },
                replacement: " ",
              }],
            },
          });
        }
      }
    }
  },
};
