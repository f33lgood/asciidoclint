import type { Rule } from "../types.js";
import { isLineInProtectedBlock } from "./utils.js";

const localAdocLinkPattern = /(^|[^\w:\\])link:(?!:)([^\s\[]+\.(?:adoc|asciidoc|asc)(?:#[^\s\[]*)?)\[[^\]]*]/gi;

export const AD044: Rule = {
  id: "AD044",
  alias: "local-adoc-link",
  description: "Local AsciiDoc files should be referenced with xref, not link",
  tags: ["core", "links", "xref"],
  parser: "text",
  docs: {
    summary: "Use xref: for local AsciiDoc source files so converted output targets are rewritten correctly.",
    rationale: "Asciidoctor documents link: for relative non-AsciiDoc files and xref: for relative AsciiDoc files. link:chapter.adoc[] renders as chapter.adoc, while xref:chapter.adoc[] renders as the converted output target such as chapter.html.",
    fixability: "unsafe",
    fixHelper: "Change link:file.adoc#id[text] to xref:file.adoc#id[text] when the target is an AsciiDoc source file and does not use URL query semantics.",
    badExamples: [{ code: "link:chapter.adoc#setup[Setup]" }],
    goodExamples: [{ code: "xref:chapter.adoc#setup[Setup]" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }
        for (const match of line.matchAll(localAdocLinkPattern)) {
          const prefixLength = match[1]?.length ?? 0;
          const target = match[2] ?? "";
          if (isExternalTarget(target)) {
            continue;
          }
          const column = (match.index ?? 0) + prefixLength + 1;
          onError({
            severity: "warning",
            message: `Local AsciiDoc link should use xref: ${target}`,
            range: { start: { file: file.file, line: index + 1, column } },
            fixHelper: "Use xref: for local AsciiDoc source files so the target is rewritten to the converted output path.",
            fix: {
              applicability: "unsafe",
              edits: [{
                file: file.file,
                range: {
                  start: { file: file.file, line: index + 1, column },
                  end: { file: file.file, line: index + 1, column: column + "link:".length },
                },
                replacement: "xref:",
              }],
            },
          });
        }
      }
    }
  },
};

function isExternalTarget(target: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("mailto:");
}
