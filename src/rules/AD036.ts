import type { Rule } from "../types.js";
import { isLineInProtectedBlock, isLineInTableBlock, isListMarkerResidueLine } from "./utils.js";

export const AD036: Rule = {
  id: "AD036",
  alias: "list-marker-residue",
  description: "Standalone list marker residue should be removed or completed",
  tags: ["cleanup", "lists"],
  parser: "text",
  docs: {
    summary: "A line containing only a list marker renders as visible text instead of a list item.",
    rationale: "AsciiDoc list items require principal text after the marker. Marker-only lines are usually conversion residue or unfinished content.",
    fixability: "no",
    fixHelper: "Remove the marker residue, add the missing list item text, or use {empty} plus a list continuation when the list item intentionally has only attached block content.",
    badExamples: [{ code: "*\nText" }],
    goodExamples: [{ code: "* Text" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const lineNumber = index + 1;
        if (
          !isListMarkerResidueLine(line)
          || isLineInProtectedBlock(document, file.file, lineNumber)
          || isLineInTableBlock(document, file.file, lineNumber)
        ) {
          continue;
        }
        onError({
          severity: "warning",
          message: "Standalone list marker renders as text",
          range: { start: { file: file.file, line: lineNumber, column: line.search(/\S/) + 1 } },
          fixHelper: "Remove the marker residue, add the missing list item text, or use {empty} plus a list continuation for a list item that intentionally has only attached block content.",
        });
      }
    }
  },
};
