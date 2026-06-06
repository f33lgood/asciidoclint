import type { Rule } from "../types.js";
import { findPrecedingTitleLineIndex, getAsciiDocTitle, hasTitleImmediatelyBefore } from "./utils.js";

export const AD010: Rule = {
  id: "AD010",
  alias: "table-title",
  description: "Table blocks should have a title",
  tags: ["core", "table"],
  parser: "document",
  docs: {
    summary: "A block table should have a preceding .Title line.",
    rationale: "Table titles make rendered tables referenceable and easier to review.",
    fixability: "no",
    fixHelper: "Add a meaningful table title using .Title immediately before the table metadata, or set title=\"...\" in the table attribute list. Derive the title from nearby section text, table headers, an imported caption, or the table purpose; do not use generic placeholders such as .Table Table.",
    badExamples: [{ code: "|===\n| A | B\n|===" }],
    goodExamples: [{ code: ".Register fields\n|===\n| A | B\n|===" }],
  },
  function: ({ document }, onError) => {
    const files = new Map(document.files.map((file) => [file.file, file.lines]));
    for (const block of document.blocks.filter((entry) => entry.type === "table")) {
      const lines = files.get(block.range.start.file);
      if (!lines) {
        continue;
      }
      const index = block.range.start.line - 1;
      const titleLine = findPrecedingTitleLineIndex(lines, index);
      const title = block.title ?? (titleLine === undefined ? undefined : getAsciiDocTitle(lines[titleLine] ?? ""));
      if (isPlaceholderTableTitle(title)) {
        onError({
          severity: "warning",
          message: "Table title is a generic placeholder",
          range: { start: { file: block.range.start.file, line: (titleLine ?? index) + 1, column: 1 } },
          fixHelper: "Replace the placeholder with a meaningful table title derived from nearby section text, table headers, an imported caption, or the table purpose.",
        });
        continue;
      }
      if (isTableCellLine(lines[index - 1] ?? "") || block.title || hasTitleImmediatelyBefore(lines, index)) {
        continue;
      }
        onError({
          severity: "warning",
          message: "Table block should have a title",
          range: { start: { file: block.range.start.file, line: block.range.start.line, column: 1 } },
          fixHelper: "Add a meaningful .Title line immediately before the table; do not use generic placeholders such as .Table Table.",
        });
    }
  },
};

function isTableCellLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed !== "|===";
}

function isPlaceholderTableTitle(title: string | undefined): boolean {
  return typeof title === "string" && /^(?:table|table\s+table)$/i.test(title.trim());
}
