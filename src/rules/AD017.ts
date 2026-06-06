import type { Rule } from "../types.js";

const captionPattern = /^Table\s+(?:\d+(?:[-.\u2010-\u2015]\d+)*|-)[.:]\s+(\S.*)$/i;

export const AD017: Rule = {
  id: "AD017",
  alias: "malformed-table-caption",
  description: "Table captions should use AsciiDoc title syntax",
  tags: ["core", "table", "docx"],
  parser: "document",
  docs: {
    summary: "A table caption line adjacent to a table should be an AsciiDoc block title.",
    rationale: "Plain Table lines imported from DOCX or Markdown do not become AsciiDoc block titles.",
    badExamples: [{ code: "Table 1: Registers\n|===\n| Name | Value\n|===" }],
    goodExamples: [{ code: ".Registers\n|===\n| Name | Value\n|===" }],
    fixability: "no",
    fixHelper: "Move the caption immediately before the table and convert it to a meaningful .Title line without the generated Table number. Preserve or derive the real caption text; do not use placeholders such as .Table Table.",
  },
  function: ({ document }, onError) => {
    const files = new Map(document.files.map((file) => [file.file, file.lines]));
    for (const block of document.blocks.filter((entry) => entry.type === "table")) {
      const lines = files.get(block.range.start.file);
      if (!lines) {
        continue;
      }
      const before = findCaptionBefore(lines, block.range.start.line - 1);
      if (before !== undefined) {
        reportCaption(onError, block.range.start.file, before + 1, lines[before] ?? "", "before");
      }
      const after = findCaptionAfter(lines, block.range.end?.line);
      if (after !== undefined) {
        reportCaption(onError, block.range.start.file, after + 1, lines[after] ?? "", "after");
      }
    }
  },
};

function findCaptionBefore(lines: string[], blockStartIndex: number): number | undefined {
  const cursor = blockStartIndex - 1;
  return captionPattern.test((lines[cursor] ?? "").trim()) ? cursor : undefined;
}

function findCaptionAfter(lines: string[], blockEndLine: number | undefined): number | undefined {
  if (!blockEndLine) {
    return undefined;
  }
  const index = blockEndLine;
  return captionPattern.test((lines[index] ?? "").trim()) ? index : undefined;
}

function reportCaption(
  onError: Parameters<Rule["function"]>[1],
  file: string,
  line: number,
  caption: string,
  position: "before" | "after",
): void {
  const title = caption.trim().match(captionPattern)?.[1] ?? "caption text";
  onError({
    severity: "warning",
    message: `Table caption should use AsciiDoc title syntax${position === "after" ? " before the table" : ""}`,
    range: { start: { file, line, column: 1 } },
    fixHelper: `Use .${title} immediately before the table so Asciidoctor generates the Table number. Preserve the meaningful caption text and do not use a generic placeholder title.`,
  });
}
