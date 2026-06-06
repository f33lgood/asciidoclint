import type { Rule } from "../types.js";
import { isLineInProtectedBlock, markdownResidueIssue } from "./utils.js";

export const AD029: Rule = {
  id: "AD029",
  alias: "markdown-link-image-residue",
  description: "Markdown link and image residue should not render as text",
  tags: ["conversion", "link", "image"],
  parser: "text",
  docs: {
    summary: "Flag Markdown link, image, and reversed-link patterns that Asciidoctor renders as paragraph text instead of links or images.",
    rationale: "Asciidoctor accepts some Markdown-compatible syntax, including Markdown-style headings and fenced code blocks. This rule only flags known conversion residue that does not become the intended AsciiDoc structure.",
    fixability: "unsafe",
    fixHelper: "Rewrite the residue using the intended AsciiDoc macro: link:target[text], xref:target[text], or image::target[Alt text].",
    badExamples: [{ code: "See [Overview](overview.adoc).\n\n![Alt](image.png)\n\n(https://example.com)[Example]" }],
    goodExamples: [{ code: "See xref:overview.adoc[Overview].\n\nimage::image.png[Alt]\n\nlink:https://example.com[Example]" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }
        const issue = markdownResidueIssue(line);
        if (!issue) {
          continue;
        }
        onError({
          severity: issue.severity,
          message: issue.message,
          range: { start: { file: file.file, line: index + 1, column: issue.column } },
          fixHelper: issue.fixHelper,
          fix: issue.replacement ? {
            applicability: "unsafe",
            edits: [{
              file: file.file,
              range: {
                start: { file: file.file, line: index + 1, column: issue.column },
                end: { file: file.file, line: index + 1, column: issue.endColumn },
              },
              replacement: issue.replacement,
            }],
          } : undefined,
        });
      }
    }
  },
};
