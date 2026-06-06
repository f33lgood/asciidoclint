import type { Rule } from "../types.js";
import {
  isAsciiDocBlockAttributeLine,
  isAsciiDocTitleLine,
  isDiagramStyleLine,
  isLineInProtectedBlock,
  parseAsciiDocAnchor,
} from "./utils.js";

export const AD057: Rule = {
  id: "AD057",
  alias: "semantic-anchor-target",
  description: "Semantic anchors should attach to the matching block type",
  tags: ["anchor", "structure", "image", "table"],
  parser: "text",
  docs: {
    summary: "Semantic figure and table anchors should attach to figure-like and table blocks.",
    rationale: "Anchors named with explicit semantic prefixes such as fig- and table- communicate author intent. If a fig- anchor attaches to a paragraph or heading instead of an image or diagram, cross references and generated output identify the wrong block.",
    fixability: "no",
    fixHelper: "Move the anchor and title immediately before the intended image, diagram, or table block. If there is no such block, remove the anchor or rename it to a non-figure/non-table ID.",
    badExamples: [{ code: "[#fig-overview]\n.Overview\n\nOverview details text." }],
    goodExamples: [{ code: "[#fig-overview]\n.Overview\nimage::overview.png[Overview]" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const anchor = parseAsciiDocAnchor(line);
        const expected = expectedTargetKind(anchor);
        if (!anchor || !expected || isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }

        const target = findSemanticAnchorTarget(file.lines, index + 1, expected);
        const matches = expected === "figure" ? target.kind === "figure" : target.kind === "table";
        if (matches) {
          continue;
        }

        onError({
          severity: "warning",
          message: expected === "figure"
            ? "Figure anchor does not attach to an image or diagram block"
            : "Table anchor does not attach to a table block",
          range: { start: { file: file.file, line: index + 1, column: 1 } },
          fixHelper: expected === "figure"
            ? "Move the fig-* anchor and meaningful .Title immediately before the intended image:: or diagram block, or remove/rename the anchor if no figure follows."
            : "Move the table-* anchor and meaningful .Title immediately before the intended |=== table block, or remove/rename the anchor if no table follows.",
        });
      }
    }
  },
};

type ExpectedTarget = "figure" | "table";

function expectedTargetKind(anchor: string | undefined): ExpectedTarget | undefined {
  if (!anchor) {
    return undefined;
  }
  if (/^(?:fig|figure)-/i.test(anchor)) {
    return "figure";
  }
  if (/^(?:table|tbl)-/i.test(anchor)) {
    return "table";
  }
  return undefined;
}

function findSemanticAnchorTarget(lines: string[], startIndex: number, expected: ExpectedTarget): { kind: "figure" | "table" | "other"; line?: string } {
  let cursor = skipBlankLines(lines, startIndex);
  if (isAsciiDocTitleLine(lines[cursor] ?? "")) {
    cursor = skipBlankLines(lines, cursor + 1);
  }

  if (expected === "figure") {
    while (isAsciiDocBlockAttributeLine(lines[cursor] ?? "") && !isDiagramStyleLine(lines[cursor] ?? "")) {
      cursor = skipBlankLines(lines, cursor + 1);
    }
    const line = lines[cursor] ?? "";
    return /^image::/.test(line.trim()) || isDiagramStyleLine(line) ? { kind: "figure", line } : { kind: "other", line };
  }

  while (isAsciiDocBlockAttributeLine(lines[cursor] ?? "")) {
    cursor = skipBlankLines(lines, cursor + 1);
  }
  const line = lines[cursor] ?? "";
  return line.trim() === "|===" ? { kind: "table", line } : { kind: "other", line };
}

function skipBlankLines(lines: string[], startIndex: number): number {
  let cursor = startIndex;
  while (cursor < lines.length && (lines[cursor] ?? "").trim() === "") {
    cursor += 1;
  }
  return cursor;
}
