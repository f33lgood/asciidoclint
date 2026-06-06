import type { Rule } from "../types.js";
import { hasAsciidoctorSections, isBook, isSpecialBlockOutsideMatchingSection, isSpecialSection } from "./specialSections.js";

export const AD053: Rule = {
  id: "AD053",
  alias: "dedication-placement",
  description: "Dedication markers should apply to documented book section levels",
  tags: ["core", "structure"],
  parser: "document",
  docs: {
    summary: "`[dedication]` should apply to a book section at a documented level.",
    rationale: "Asciidoctor documents dedication as a book special section. Asciidoctor.js accepts article, nested, and block-applied dedication markers silently, so linting keeps the source aligned with book front-matter semantics.",
    badExamples: [{ code: "= Article\n\n[dedication]\n== Dedication" }],
    goodExamples: [{ code: "= Book\n:doctype: book\n\n[dedication]\n== Dedication\n\nFor the team." }],
    fixability: "no",
    fixHelper: "Use `[dedication]` only on a level-0 or level-1 book section.",
  },
  function: ({ document }, onError) => {
    const hasSectionData = hasAsciidoctorSections(document);
    for (const block of document.blocks.filter((candidate) => isSpecialBlockOutsideMatchingSection(document, candidate, "dedication", hasSectionData))) {
      onError({
        severity: "warning",
        message: "[dedication] should apply to a section heading",
        range: { start: block.range.start },
        fixHelper: "Move `[dedication]` immediately before the dedication section heading, or remove it.",
      });
    }
    for (const section of document.sections.filter((candidate) => isSpecialSection(candidate, "dedication", hasSectionData))) {
      if (!isBook(document)) {
        onError({
          severity: "warning",
          message: "Dedication section is documented for book doctype, not article documents",
          range: { start: section.titleRange.start },
          fixHelper: "Remove `[dedication]` or change the document to `:doctype: book`.",
        });
        continue;
      }
      if (section.level > 1) {
        onError({
          severity: "warning",
          message: "Book dedication should use a level-0 or level-1 section heading, not a nested subsection",
          range: { start: section.titleRange.start },
          fixHelper: "Move `[dedication]` to the dedication section heading, or remove it from this nested subsection.",
        });
      }
    }
  },
};
