import type { Rule } from "../types.js";
import { hasAsciidoctorSections, isBook, isSpecialBlockOutsideMatchingSection, isSpecialSection } from "./specialSections.js";

export const AD054: Rule = {
  id: "AD054",
  alias: "colophon-placement",
  description: "Colophon markers should apply to documented book section levels",
  tags: ["core", "structure"],
  parser: "document",
  docs: {
    summary: "`[colophon]` should apply to a book section at a documented level.",
    rationale: "Asciidoctor documents colophon as a book special section. Asciidoctor.js accepts article, nested, and block-applied colophon markers silently, so linting keeps the source aligned with book special-section semantics.",
    badExamples: [{ code: "= Article\n\n[colophon]\n== Colophon" }],
    goodExamples: [{ code: "= Book\n:doctype: book\n\n[colophon]\n== Colophon\n\nProduction notes." }],
    fixability: "no",
    fixHelper: "Use `[colophon]` only on a level-0 or level-1 book section.",
  },
  function: ({ document }, onError) => {
    const hasSectionData = hasAsciidoctorSections(document);
    for (const block of document.blocks.filter((candidate) => isSpecialBlockOutsideMatchingSection(document, candidate, "colophon", hasSectionData))) {
      onError({
        severity: "warning",
        message: "[colophon] should apply to a section heading",
        range: { start: block.range.start },
        fixHelper: "Move `[colophon]` immediately before the colophon section heading, or remove it.",
      });
    }
    for (const section of document.sections.filter((candidate) => isSpecialSection(candidate, "colophon", hasSectionData))) {
      if (!isBook(document)) {
        onError({
          severity: "warning",
          message: "Colophon section is documented for book doctype, not article documents",
          range: { start: section.titleRange.start },
          fixHelper: "Remove `[colophon]` or change the document to `:doctype: book`.",
        });
        continue;
      }
      if (section.level > 1) {
        onError({
          severity: "warning",
          message: "Book colophon should use a level-0 or level-1 section heading, not a nested subsection",
          range: { start: section.titleRange.start },
          fixHelper: "Move `[colophon]` to the colophon section heading, or remove it from this nested subsection.",
        });
      }
    }
  },
};
