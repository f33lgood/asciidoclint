import path from "node:path";
import type { Rule } from "../types.js";
import { isLineInProtectedBlock } from "./utils.js";

const inlineImagePattern = /(^|[^\w:])image:(?!:)([^\s\[]+)\[((?:\\]|[^\]])*)]/g;

export const AD028: Rule = {
  id: "AD028",
  alias: "image-alt-text",
  description: "Images should not explicitly set empty alt text",
  tags: ["accessibility", "image"],
  parser: "document",
  docs: {
    summary: "Image macros should not explicitly set empty alt text.",
    rationale: "Asciidoctor derives fallback alt text from the image target when the attribute list is empty. An explicit empty alt attribute renders an empty alt value, which weakens accessible output and fallback text.",
    fixability: "no",
    fixHelper: "Replace the empty alt attribute with concise text that identifies the image purpose, or remove the explicit empty alt when the derived target name is acceptable.",
    badExamples: [{ code: "image::diagram.png[alt=\"\"]\n\nClick image:play.png[\"\"] to start." }],
    goodExamples: [{ code: "image::diagram.png[Architecture diagram]\n\nClick image:play.png[Play] to start." }],
  },
  function: ({ document }, onError) => {
    for (const block of document.blocks.filter((candidate) => candidate.type === "image")) {
      if (typeof block.attributes.alt !== "string" || block.attributes.alt.trim() === "") {
        const target = String(block.attributes.target ?? "image");
        onError({
          severity: "warning",
          message: `Image is missing alt text: ${path.basename(target)}`,
          range: block.range,
          fixHelper: "Add meaningful text as the first image macro attribute, such as image::target.png[Architecture diagram].",
        });
      }
    }

    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }
        for (const match of line.matchAll(inlineImagePattern)) {
          const attributes = match[3] ?? "";
          if (!hasExplicitEmptyAlt(attributes)) {
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
