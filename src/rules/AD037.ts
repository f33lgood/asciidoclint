import type { Rule } from "../types.js";
import { isLineInProtectedBlock, isLineInTableBlock, isUnderlineResidueLine } from "./utils.js";

export const AD037: Rule = {
  id: "AD037",
  alias: "underline-residue",
  description: "Standalone underline residue should be removed or converted",
  tags: ["cleanup", "conversion"],
  parser: "text",
  docs: {
    summary: "A standalone three-underscore line is usually leftover underline styling from converted documents.",
    rationale: "AsciiDoc uses four or more underscores for quote block delimiters, but exactly three underscores are not document structure and render as visible residue.",
    fixability: "no",
    fixHelper: "Remove the three-underscore residue, or convert the intended underlined text to AsciiDoc emphasis such as _text_. Keep four or more underscores only when they are matching quote block delimiters.",
    badExamples: [{ code: "Important\n___" }],
    goodExamples: [{ code: "_Important_" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const lineNumber = index + 1;
        if (
          !isUnderlineResidueLine(line)
          || isLineInProtectedBlock(document, file.file, lineNumber)
          || isLineInTableBlock(document, file.file, lineNumber)
        ) {
          continue;
        }
        onError({
          severity: "warning",
          message: "Standalone three-underscore residue should be removed",
          range: { start: { file: file.file, line: lineNumber, column: line.search(/\S/) + 1 } },
          fixHelper: "Remove the three-underscore residue or convert the intended underlined text to AsciiDoc emphasis.",
        });
      }
    }
  },
};
