import type { Rule } from "../types.js";

export const AD020: Rule = {
  id: "AD020",
  alias: "appendix-section-level",
  description: "Appendices should be section-level blocks in article documents",
  tags: ["core", "structure"],
  parser: "document",
  docs: {
    summary: "An appendix in an article document should use a section heading, not a second document title.",
    rationale: "Asciidoctor documents article appendices as level-1 sections. A [appendix] block followed by = in an article triggers Asciidoctor's level-0 section error.",
    badExamples: [{ code: "[appendix]\n= API Reference" }],
    goodExamples: [
      { code: "[appendix]\n== API Reference\n\n=== Child" },
      { code: ":doctype: book\n\n= Book\n\n[appendix]\n= API Reference\n\n=== Child" },
    ],
    fixability: "no",
    fixHelper: "In article documents, change the appendix heading to ==. Keep = only for a book appendix that is intentionally part-like.",
  },
  function: ({ document }, onError) => {
    if (document.attributes.doctype === "book") {
      return;
    }
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (line.trim() !== "[appendix]") {
          continue;
        }
        const title = file.lines[index + 1] ?? "";
        if (!/^=\s+\S/.test(title)) {
          continue;
        }
        onError({
          severity: "warning",
          message: "Appendix should use a section-level heading",
          range: { start: { file: file.file, line: index + 2, column: 1 } },
          fixHelper: "Use == for an article appendix heading, with === or deeper headings for child sections. Keep = only for a book appendix that is intentionally part-like.",
        });
      }
    }
  },
};
