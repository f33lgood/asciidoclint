import type { Rule } from "../types.js";
import { isLineInProtectedBlock } from "./utils.js";

const captionPattern = /^Figure\s+(?:\d+(?:[-.\u2010-\u2015]\d+)*|-)[.:]\s+(\S.*)$/i;

export const AD016: Rule = {
  id: "AD016",
  alias: "malformed-figure-caption",
  description: "Figure captions should use AsciiDoc title syntax",
  tags: ["core", "image", "diagram", "docx"],
  parser: "document",
  docs: {
    summary: "A figure caption line adjacent to an image or diagram should be an AsciiDoc block title.",
    rationale: "Plain Figure lines imported from DOCX or Markdown do not become AsciiDoc block titles.",
    badExamples: [{ code: "Figure 1: Overview\nimage::overview.png[Overview]" }],
    goodExamples: [{ code: ".Overview\nimage::overview.png[Overview]" }],
    fixability: "no",
    fixHelper: "Move the caption immediately before the image or diagram and convert it to a meaningful .Title line without the generated Figure number. Preserve or derive the real caption text; do not invent placeholders such as .Figure.",
  },
  function: ({ document }, onError) => {
    const files = new Map(document.files.map((file) => [file.file, file.lines]));
    const reported = new Set<string>();
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (!line.trim().startsWith("image::") || isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }
        const before = findCaptionBefore(file.lines, index);
        if (before !== undefined) {
          reportCaption(onError, reported, file.file, before + 1, file.lines[before] ?? "", "before");
        }
      }
    }
    for (const block of document.blocks.filter((entry) => entry.type === "image" || entry.type === "diagram")) {
      const lines = files.get(block.range.start.file);
      if (!lines) {
        continue;
      }
      const before = findCaptionBefore(lines, block.range.start.line - 1, block.type === "diagram");
      if (before !== undefined) {
        reportCaption(onError, reported, block.range.start.file, before + 1, lines[before] ?? "", "before");
      }
      const after = findCaptionAfter(lines, block.range.end?.line ?? findDelimitedBlockEnd(lines, block.range.start.line - 1));
      if (after !== undefined) {
        reportCaption(onError, reported, block.range.start.file, after + 1, lines[after] ?? "", "after");
      }
    }
  },
};

function findCaptionBefore(lines: string[], blockStartIndex: number, allowDiagramStyleLine = false): number | undefined {
  let cursor = blockStartIndex - 1;
  if (allowDiagramStyleLine && isDiagramStyleLine(lines[cursor] ?? "")) {
    cursor -= 1;
  }
  return captionPattern.test((lines[cursor] ?? "").trim()) ? cursor : undefined;
}

function findCaptionAfter(lines: string[], blockEndLine: number | undefined): number | undefined {
  if (!blockEndLine) {
    return undefined;
  }
  const index = blockEndLine;
  return captionPattern.test((lines[index] ?? "").trim()) ? index : undefined;
}

function findDelimitedBlockEnd(lines: string[], blockStartIndex: number): number | undefined {
  const delimiter = lines[blockStartIndex]?.trim();
  if (!delimiter || !["----", "....", "++++", "____", "===="].includes(delimiter)) {
    return blockStartIndex + 1;
  }
  for (let index = blockStartIndex + 1; index < lines.length; index += 1) {
    if ((lines[index] ?? "").trim() === delimiter) {
      return index + 1;
    }
  }
  return blockStartIndex + 1;
}

function isDiagramStyleLine(line: string): boolean {
  return /^\[[^\]]+\]\s*$/.test(line.trim());
}

function reportCaption(
  onError: Parameters<Rule["function"]>[1],
  reported: Set<string>,
  file: string,
  line: number,
  caption: string,
  position: "before" | "after",
): void {
  const key = `${file}:${line}`;
  if (reported.has(key)) {
    return;
  }
  reported.add(key);
  const title = caption.trim().match(captionPattern)?.[1] ?? "caption text";
  onError({
    severity: "warning",
    message: `Figure caption should use AsciiDoc title syntax${position === "after" ? " before the figure" : ""}`,
    range: { start: { file, line, column: 1 } },
    fixHelper: `Use .${title} immediately before the image or diagram so Asciidoctor generates the Figure number. Preserve the meaningful caption text and do not use a generic placeholder title.`,
  });
}
