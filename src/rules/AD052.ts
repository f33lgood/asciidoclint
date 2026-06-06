import type { Rule } from "../types.js";
import { hasAsciidoctorSections, isBook, isSpecialBlockOutsideMatchingSection, isSpecialSection } from "./specialSections.js";

export const AD052: Rule = {
  id: "AD052",
  alias: "acknowledgments-placement",
  description: "Acknowledgments markers should apply to documented book section levels",
  tags: ["core", "structure"],
  parser: "document",
  docs: {
    summary: "`[acknowledgments]` should apply to a book section at a documented level.",
    rationale: "Asciidoctor documents acknowledgments as a book special section. Asciidoctor.js accepts article, nested, and block-applied acknowledgments markers silently, so linting keeps the source aligned with book special-section semantics.",
    badExamples: [{ code: "= Article\n\n[acknowledgments]\n== Thanks" }],
    goodExamples: [{ code: "= Book\n:doctype: book\n\n[acknowledgments]\n== Acknowledgments\n\nThanks." }],
    fixability: "no",
    fixHelper: "Use `[acknowledgments]` only on a level-0 or level-1 book section.",
  },
  function: ({ document }, onError) => {
    const hasSectionData = hasAsciidoctorSections(document);
    for (const block of document.blocks.filter((candidate) => isSpecialBlockOutsideMatchingSection(document, candidate, "acknowledgments", hasSectionData))) {
      onError({
        severity: "warning",
        message: "[acknowledgments] should apply to a section heading",
        range: { start: block.range.start },
        fixHelper: "Move `[acknowledgments]` immediately before the acknowledgments section heading, or remove it.",
      });
    }
    for (const section of document.sections.filter((candidate) => isSpecialSection(candidate, "acknowledgments", hasSectionData))) {
      if (!isBook(document)) {
        onError({
          severity: "warning",
          message: "Acknowledgments section is documented for book doctype, not article documents",
          range: { start: section.titleRange.start },
          fixHelper: "Remove `[acknowledgments]` or change the document to `:doctype: book`.",
        });
        continue;
      }
      if (section.level > 1) {
        onError({
          severity: "warning",
          message: "Book acknowledgments should use a level-0 or level-1 section heading, not a nested subsection",
          range: { start: section.titleRange.start },
          fixHelper: "Move `[acknowledgments]` to the acknowledgments section heading, or remove it from this nested subsection.",
        });
      }
    }
  },
};
