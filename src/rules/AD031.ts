import type { Rule } from "../types.js";
import { isLineInProtectedBlock } from "./utils.js";

const outerLinkPattern = /(?:link|xref):[^\s\[]+\[|https?:\/\/[^\s\[]+\[/g;
const nestedLinkPattern = /(?:link|xref):[^\s\[]+\[|<<[^>]+>>/;

export const AD031: Rule = {
  id: "AD031",
  alias: "no-nested-link-text",
  description: "Link text should not contain nested links or cross references",
  tags: ["links", "conversion"],
  parser: "text",
  docs: {
    summary: "Visible link text should not contain another AsciiDoc link, URL macro, or shorthand cross reference.",
    rationale: "Nested link markup can render invalid nested anchors, malformed labels, or escaped reference text. This is often conversion residue from HTML or Markdown sources.",
    fixability: "no",
    fixHelper: "Replace the nested link markup with plain visible text, or split the sentence into separate links.",
    badExamples: [{ code: "link:https://example.com[link:https://nested.example[Nested]]\n\nxref:target.adoc[<<target,Target>>]" }],
    goodExamples: [{ code: "link:https://example.com[Example]" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }
        for (const match of line.matchAll(outerLinkPattern)) {
          const attrStart = (match.index ?? 0) + match[0].length;
          const attrText = linkAttributeText(line, attrStart);
          if (!attrText || !nestedLinkPattern.test(attrText)) {
            continue;
          }
          onError({
            severity: "warning",
            message: "Link text should not contain nested links or cross references",
            range: { start: { file: file.file, line: index + 1, column: (match.index ?? 0) + 1 } },
            fixHelper: "Replace nested link markup with plain visible text, or split this into separate links.",
          });
        }
      }
    }
  },
};

function linkAttributeText(line: string, start: number): string | undefined {
  let depth = 1;
  let escaped = false;
  for (let index = start; index < line.length; index += 1) {
    const character = line[index] ?? "";
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "[") {
      depth += 1;
      continue;
    }
    if (character === "]") {
      depth -= 1;
      if (depth === 0) {
        return line.slice(start, index);
      }
    }
  }
  return undefined;
}
