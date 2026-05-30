import type { Rule } from "../types.js";
import { isLineInProtectedBlock } from "./utils.js";

const xrefPattern = /(?<!\\)\bxref:([^\s\[]+)\[([^\]]*)]/g;
const adocTargetPattern = /\.a(?:scii)?doc(?:#|$)/i;
const namedAttributePattern = /^[A-Za-z_][\w.-]*\s*=/;

function firstAttribute(attrlist: string): string {
  let quote: string | undefined;
  for (let index = 0; index < attrlist.length; index += 1) {
    const char = attrlist[index];
    if ((char === '"' || char === "'") && attrlist[index - 1] !== "\\") {
      quote = quote === char ? undefined : quote ?? char;
    } else if (char === "," && quote === undefined) {
      return attrlist.slice(0, index).trim();
    }
  }
  return attrlist.trim();
}

function hasExplicitText(attrlist: string): boolean {
  const first = firstAttribute(attrlist);
  return first.length > 0 && !namedAttributePattern.test(first);
}

export const AD042: Rule = {
  id: "AD042",
  alias: "interdocument-xref-text",
  description: "Interdocument xrefs should provide explicit link text",
  tags: ["xref", "links", "accessibility"],
  parser: "text",
  docs: {
    summary: "Flag interdocument xref macros that omit the first positional link-text attribute.",
    rationale:
      "AsciiDoc allows intradocument xrefs to derive text from the target, but Asciidoctor documents interdocument xref text as required. When omitted, Asciidoctor.js renders a weak converted filename label.",
    fixability: "no",
    fixHelper: "Add human-readable text as the first xref attribute, before named attributes such as window or xrefstyle.",
    badExamples: [{ code: "See xref:chapter.adoc[] and xref:chapter.adoc#overview[window=_blank]." }],
    goodExamples: [
      {
        code: "See xref:chapter.adoc[Chapter overview] and xref:chapter.adoc#overview[Overview,window=_blank].",
      },
    ],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }
        for (const match of line.matchAll(xrefPattern)) {
          const target = match[1] ?? "";
          const attrlist = match[2] ?? "";
          if (!adocTargetPattern.test(target) || hasExplicitText(attrlist)) {
            continue;
          }
          onError({
            severity: "warning",
            message: "Interdocument xref is missing explicit link text",
            range: { start: { file: file.file, line: index + 1, column: (match.index ?? 0) + 1 } },
            fixHelper: `Add descriptive text to the xref for ${target}.`,
          });
        }
      }
    }
  },
};
