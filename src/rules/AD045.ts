import type { Rule, SourceRange } from "../types.js";
import { isLineInProtectedBlock } from "./utils.js";

type HeadingStyle = "asciidoc" | "markdown";

interface HeadingMarker {
  style: HeadingStyle;
  marker: string;
  range: SourceRange;
}

const headingPattern = /^(=+|#+)\s+\S/;

export const AD045: Rule = {
  id: "AD045",
  alias: "markdown-heading-mix",
  description: "Markdown-compatible headings should not be mixed with AsciiDoc headings",
  tags: ["headings", "markdown-compatibility", "maintainability"],
  parser: "document",
  docs: {
    summary: "Do not mix AsciiDoc = headings and Markdown-compatible # headings in one document graph.",
    rationale: "Asciidoctor accepts Markdown-style headings as optional compatibility syntax, so using them is not invalid. Mixing both marker styles in one document tree makes hierarchy review and style maintenance harder.",
    fixability: "unsafe",
    fixHelper: "Convert the less common heading marker style to the dominant style in the document graph, preserving the marker length.",
    badExamples: [{ code: "= Title\n\n== Overview\n\n## Markdown-style Section" }],
    goodExamples: [
      { code: "= Title\n\n== Overview\n\n== AsciiDoc-style Section" },
      { code: "## Overview\n\n## Markdown-style Section" },
    ],
  },
  function: ({ document }, onError) => {
    const headings: HeadingMarker[] = [];
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }
        const match = line.match(headingPattern);
        if (!match) {
          continue;
        }
        const marker = match[1] ?? "";
        headings.push({
          style: marker.startsWith("#") ? "markdown" : "asciidoc",
          marker,
          range: {
            start: { file: file.file, line: index + 1, column: 1 },
            end: { file: file.file, line: index + 1, column: marker.length + 1 },
          },
        });
      }
    }

    const asciidocCount = headings.filter((heading) => heading.style === "asciidoc").length;
    const markdownCount = headings.filter((heading) => heading.style === "markdown").length;
    if (asciidocCount === 0 || markdownCount === 0) {
      return;
    }

    const dominant: HeadingStyle = asciidocCount >= markdownCount ? "asciidoc" : "markdown";
    for (const heading of headings.filter((candidate) => candidate.style !== dominant)) {
      const replacementMarker = dominant === "asciidoc" ? "=".repeat(heading.marker.length) : "#".repeat(heading.marker.length);
      onError({
        severity: "info",
        message: `Markdown-compatible heading style is mixed with AsciiDoc heading style: ${heading.marker}`,
        range: heading.range,
        fixHelper: `Use ${replacementMarker} to match the dominant ${dominant === "asciidoc" ? "AsciiDoc" : "Markdown-compatible"} heading style in this document graph.`,
        fix: {
          applicability: "unsafe",
          edits: [{
            file: heading.range.start.file,
            range: heading.range,
            replacement: replacementMarker,
          }],
        },
      });
    }
  },
};
