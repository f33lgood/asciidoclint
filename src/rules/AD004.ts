import type { Rule } from "../types.js";
import { countTableCells } from "./utils.js";

export const AD004: Rule = {
  id: "AD004",
  alias: "table-cell-count",
  description: "Table source should not contain cells omitted from rendered output",
  tags: ["core", "table"],
  parser: "document",
  docs: {
    summary: "A table should not end with incomplete cells that Asciidoctor omits from the rendered output.",
    fixability: "no",
    fixHelper: "Add missing table cells, remove leftover cells, or make intended row and column spans explicit so every source cell appears in the rendered table.",
    badExamples: [{ code: "[cols=\"1,1\"]\n|===\n| one | two | omitted\n|===" }],
    goodExamples: [{ code: "[cols=\"1,1\"]\n|===\n| one | two\n|===" }],
  },
  function: ({ document }, onError) => {
    for (const block of document.blocks.filter((entry) => entry.type === "table")) {
      if (!block.range.end || block.attributes.format || block.attributes.separator) {
        continue;
      }
      const file = document.files.find((entry) => entry.file === block.range.start.file);
      if (!file) {
        continue;
      }
      if (containsNestedDefaultPsvTable(file.lines, block.range.start.line, block.range.end.line)) {
        continue;
      }
      const sourceCells = countSourceCells(file.lines, block.range.start.line, block.range.end.line);
      const renderedCells = block.table?.renderedCellCount;
      if (renderedCells !== undefined && sourceCells > renderedCells) {
        onError({
          severity: "warning",
          message: `Table source has ${sourceCells - renderedCells} cell${sourceCells - renderedCells === 1 ? "" : "s"} that Asciidoctor did not render`,
          range: { start: block.range.start },
          fixHelper: "Add the missing cells, remove the extra cells, or make the intended row and column spans explicit.",
        });
      }
    }
  },
};

function countSourceCells(lines: string[], startLine: number, endLine: number): number {
  let count = 0;
  for (let index = startLine; index < endLine - 1; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "|===") {
      continue;
    }
    count += countTableCells(line);
  }
  return count;
}

function containsNestedDefaultPsvTable(lines: string[], startLine: number, endLine: number): boolean {
  for (let index = startLine; index < endLine - 1; index += 1) {
    if ((lines[index] ?? "").trim() === "|===") {
      return true;
    }
  }
  return false;
}
