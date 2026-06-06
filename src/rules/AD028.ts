import path from "node:path";
import type { Rule } from "../types.js";
import { isLineComment, isLineInCommentParagraph, isLineInProtectedBlock } from "./utils.js";

const inlineImagePattern = /(^|[^\w:])image:(?!:)([^\s\[]+)\[((?:\\]|[^\]])*)]/g;
const blockImagePattern = /(^|[^\w:])image::([^\s\[]+)\[((?:\\]|[^\]])*)]/g;

export const AD028: Rule = {
  id: "AD028",
  alias: "image-alt-text",
  description: "Images should provide meaningful alt text",
  tags: ["accessibility", "image", "docx"],
  parser: "document",
  docs: {
    summary: "Image macros should not explicitly set empty or generated placeholder alt text.",
    rationale: "Asciidoctor derives fallback alt text from the image target when the attribute list is empty. An explicit empty alt attribute renders an empty alt value, and imported placeholder descriptions carry weak imported text into accessible output.",
    fixability: "no",
    fixHelper: "Replace the empty or generated placeholder alt attribute with concise text that identifies the image purpose, or remove the explicit empty alt when the derived target name is acceptable.",
    badExamples: [{ code: "image::diagram.png[alt=\"\"]\n\nimage::chart.png[Diagram Description automatically generated]" }],
    goodExamples: [{ code: "image::diagram.png[Overview diagram]\n\nClick image:play.png[Play] to start." }],
  },
  function: ({ document }, onError) => {
    const generatedAltReported = new Set<string>();
    for (const block of document.blocks.filter((candidate) => candidate.type === "image")) {
      const file = document.files.find((entry) => entry.file === block.range.start.file);
      const sourceLineIndex = block.range.start.line - 1;
      const sourceLine = file?.lines[sourceLineIndex] ?? "";
      if (
        file
        && (
          isLineComment(sourceLine)
          || isLineInCommentParagraph(file.lines, sourceLineIndex)
          || isLineInProtectedBlock(document, file.file, block.range.start.line)
        )
      ) {
        continue;
      }
      if (typeof block.attributes.alt !== "string" || block.attributes.alt.trim() === "") {
        const target = String(block.attributes.target ?? "image");
        onError({
          severity: "warning",
          message: `Image is missing alt text: ${path.basename(target)}`,
          range: block.range,
          fixHelper: "Add meaningful text as the first image macro attribute, such as image::target.png[Overview diagram].",
        });
        continue;
      }
      if (isGeneratedPlaceholderAltText(block.attributes.alt)) {
        generatedAltReported.add(`${block.range.start.file}:${block.range.start.line}`);
        onError({
          severity: "warning",
          message: "Image alt text appears to be an imported placeholder",
          range: block.range,
          fixHelper: "Replace the generated placeholder with concise text that describes the image purpose.",
        });
      }
    }

    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (
          isLineComment(line)
          || isLineInCommentParagraph(file.lines, index)
          || isLineInProtectedBlock(document, file.file, index + 1)
        ) {
          continue;
        }
        for (const match of line.matchAll(blockImagePattern)) {
          const attributes = match[3] ?? "";
          if (!generatedPlaceholderAttributeText(attributes) || generatedAltReported.has(`${file.file}:${index + 1}`)) {
            continue;
          }
          const prefixLength = match[1]?.length ?? 0;
          onError({
            severity: "warning",
            message: "Image alt text appears to be an imported placeholder",
            range: {
              start: {
                file: file.file,
                line: index + 1,
                column: (match.index ?? 0) + prefixLength + 1,
              },
            },
            fixHelper: "Replace the generated placeholder with concise text that describes the image purpose.",
          });
        }
        for (const match of line.matchAll(inlineImagePattern)) {
          const attributes = match[3] ?? "";
          if (!hasExplicitEmptyAlt(attributes)) {
            const generatedAltText = generatedPlaceholderAttributeText(attributes);
            if (!generatedAltText) {
              continue;
            }
            const prefixLength = match[1]?.length ?? 0;
            onError({
              severity: "warning",
              message: "Image alt text appears to be an imported placeholder",
              range: {
                start: {
                  file: file.file,
                  line: index + 1,
                  column: (match.index ?? 0) + prefixLength + 1,
                },
              },
              fixHelper: "Replace the generated placeholder with concise text that describes the image purpose.",
            });
            continue;
          }
          const target = match[2] ?? "image";
          const prefixLength = match[1]?.length ?? 0;
          onError({
            severity: "warning",
            message: `Image is missing alt text: ${path.basename(target)}`,
            range: {
              start: {
                file: file.file,
                line: index + 1,
                column: (match.index ?? 0) + prefixLength + 1,
              },
            },
            fixHelper: "Add meaningful text as the first inline image macro attribute, such as image:target.png[Status icon].",
          });
        }
      }
    }
  },
};

function hasExplicitEmptyAlt(attributes: string): boolean {
  for (const [index, entry] of splitAttributeEntries(attributes).entries()) {
    const named = entry.match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/);
    if (named) {
      const name = named[1] ?? "";
      const value = named[2] ?? "";
      if (name.toLowerCase() === "alt" && unquote(value).trim() === "") {
        return true;
      }
      continue;
    }

    if (index === 0 && /^(['"])(?:\s*)\1$/.test(entry.trim())) {
      return true;
    }
  }
  return false;
}

function generatedPlaceholderAttributeText(attributes: string): string | undefined {
  return splitAttributeEntries(attributes)
    .map((entry) => unquote(entry))
    .find((entry) => isGeneratedPlaceholderAltText(entry));
}

function isGeneratedPlaceholderAltText(value: string): boolean {
  return /\bDescription automatically generated(?:\s+with\s+(?:low|medium|high)\s+confidence)?$/i.test(value.trim());
}

function splitAttributeEntries(attributes: string): string[] {
  const entries: string[] = [];
  let current = "";
  let quote: string | undefined;
  for (let index = 0; index < attributes.length; index += 1) {
    const character = attributes[index] ?? "";
    if (character === "\\" && index + 1 < attributes.length) {
      current += character + (attributes[index + 1] ?? "");
      index += 1;
      continue;
    }
    if ((character === "\"" || character === "'") && quote === undefined) {
      quote = character;
      current += character;
      continue;
    }
    if (character === quote) {
      quote = undefined;
      current += character;
      continue;
    }
    if (character === "," && quote === undefined) {
      entries.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  entries.push(current.trim());
  return entries;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
