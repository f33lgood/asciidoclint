import type { BlockNode, Rule, SectionNode } from "../types.js";

export const AD020: Rule = {
  id: "AD020",
  alias: "appendix-placement",
  description: "Appendix markers should apply to documented appendix section levels",
  tags: ["core", "structure"],
  parser: "document",
  docs: {
    summary: "`[appendix]` should apply to a section heading at a documented appendix level.",
    rationale: "Asciidoctor documents article appendices as level-1 sections. Book appendices can be level 1 when adjacent to chapters or level 0 when adjacent to parts. Asciidoctor.js accepts nested appendix markers silently and can render confusing appendix numbering.",
    badExamples: [
      { code: "[appendix]\n= API Reference" },
      { code: "== Body\n\n[appendix]\n=== Nested Appendix" },
      { code: "[appendix]\n----\nBlock\n----" },
    ],
    goodExamples: [
      { code: "[appendix]\n== API Reference\n\n=== Child" },
      { code: ":doctype: book\n\n= Book\n\n[appendix]\n= API Reference\n\n=== Child" },
    ],
    fixability: "no",
    fixHelper: "Use `[appendix]` before the appendix section heading. In articles, use `==`; in books, use `==` for chapter-adjacent appendices or `=` for part-adjacent appendices.",
  },
  function: ({ document }, onError) => {
    const isBook = document.attributes.doctype === "book";
    const hasAsciidoctorSections = document.sections.some((section) => section.source === "asciidoctor");
    for (const block of document.blocks.filter(isAppendixBlock)) {
      onError({
        severity: "warning",
        message: "[appendix] should apply to a section heading",
        range: { start: block.range.start },
        fixHelper: "Move `[appendix]` immediately before the appendix section heading, or remove it if this is not an appendix section.",
      });
    }

    for (const section of document.sections.filter((candidate) => isAppendixSection(candidate, hasAsciidoctorSections))) {
      if (!isBook && section.level !== 1) {
        onError({
          severity: "warning",
          message: "Article appendix should use a level-1 section heading",
          range: { start: section.titleRange.start },
          fixHelper: "Use `==` for an article appendix heading. Use `===` or deeper headings only for child sections inside the appendix.",
        });
        continue;
      }

      if (isBook && section.level > 1) {
        onError({
          severity: "warning",
          message: "Book appendix should use a level-0 or level-1 section heading, not a nested subsection",
          range: { start: section.titleRange.start },
          fixHelper: "Remove `[appendix]` from this nested subsection, or move `[appendix]` to the containing appendix section. Use `==` for chapter-adjacent book appendices or `=` for part-adjacent book appendices.",
        });
      }
    }
  },
};

function isAppendixSection(section: SectionNode, hasAsciidoctorSections: boolean): boolean {
  return section.sectname === "appendix"
    || (section.source === "asciidoctor" && section.style === "appendix")
    || (!hasAsciidoctorSections && section.style === "appendix");
}

function isAppendixBlock(block: BlockNode): boolean {
  return block.style === "appendix" && block.context !== "section";
}
