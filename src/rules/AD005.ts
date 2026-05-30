import type { Rule } from "../types.js";

export const AD005: Rule = {
  id: "AD005",
  alias: "explicit-document-title",
  description: "Root documents should provide an explicit document title",
  tags: ["core", "headings"],
  parser: "document",
  docs: {
    summary: "A root AsciiDoc document should have an explicit document title, either as a level-0 title, :doctitle:, :title:, or a wrapper title include.",
    rationale: "Document titles are optional in Asciidoctor article and book documents, but explicit titles make generated metadata and visible document structure more predictable.",
    fixability: "no",
    fixHelper: "Add an explicit '= Title', ':doctitle:', or ':title:' to the root document, or make the wrapper document include a title page as its first include.",
    badExamples: [{ code: "== Overview\n\nContent." }],
    goodExamples: [
      { code: "= Product Guide\n\n== Overview\n\nContent." },
      { code: ":doctitle: Product Guide\n\n== Overview\n\nContent." },
      { code: ":title: Product Guide\n\n== Overview\n\nContent." },
      { code: ":doctype: book\n\n= Product Guide\n\n= Part One\n\n== Chapter One" },
      { code: "include::title-page.adoc[]\ninclude::chapter.adoc[]\n\n// title-page.adoc\n= Product Guide" },
    ],
  },
  function: ({ document }, onError) => {
    if (!document.sections.some((section) => section.level === 0) && !document.attributes.title && !document.attributes.doctitle) {
      onError({
        severity: "info",
        message: "Document is missing an explicit document title",
        range: { start: { file: document.file, line: 1, column: 1 } },
        fixHelper: "Add a document title such as '= Title' before the first section, or set :title: / :doctitle: in the header.",
      });
    }
  },
};
