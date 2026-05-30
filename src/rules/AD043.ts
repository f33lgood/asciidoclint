import type { Rule } from "../types.js";
import { isLineInProtectedBlock } from "./utils.js";

export const AD043: Rule = {
  id: "AD043",
  alias: "section-title-start-left",
  description: "Section title syntax should start at the beginning of the line",
  tags: ["headings", "structure"],
  parser: "text",
  docs: {
    summary: "Flag indented lines that look like AsciiDoc section titles.",
    rationale:
      "AsciiDoc section titles are block starts aligned to the left margin. An indented section-title-looking line is valid literal content, but it is not part of the section tree.",
    fixability: "no",
    fixHelper:
      "If the line is intended to be a section title, remove the leading indentation. If it is intended as literal example text, put it in an explicit listing or literal block.",
    badExamples: [{ code: "= Title\n\n == Intended Section\n\n ## Intended Markdown-Compatible Section\n\nText." }],
    goodExamples: [{ code: "= Title\n\n== Intended Section\n\n## Intended Markdown-Compatible Section\n\nText." }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (!/^[ \t]+(?:={1,6}|#{1,6})[ \t]+\S/.test(line) || isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }
        onError({
          severity: "warning",
          message: "Indented section-title-looking line renders as literal text, not as a section",
          range: { start: { file: file.file, line: index + 1, column: 1 } },
        });
      }
    }
  },
};
