import type { Rule } from "../types.js";
import { hasAsciidoctorSections, isSpecialBlockOutsideMatchingSection, isSpecialSection } from "./specialSections.js";

export const AD048: Rule = {
  id: "AD048",
  alias: "bibliography-placement",
  description: "Bibliography markers should apply to documented bibliography sections",
  tags: ["core", "structure"],
  parser: "document",
  docs: {
    summary: "`[bibliography]` should apply to a section heading, not an ordinary block.",
    rationale: "Asciidoctor documents bibliography as a special section style and also allows bibliographies to be nested for scoped reference lists. Asciidoctor.js accepts the same style on ordinary blocks without creating a bibliography section, so linting catches the structural no-op while preserving documented nested bibliography use.",
    badExamples: [{ code: "= Article\n\n[bibliography]\nReference text." }],
    goodExamples: [{ code: "= Article\n\n[bibliography]\n== References\n\n* [[[ref]]] Reference." }],
    fixability: "no",
    fixHelper: "Move `[bibliography]` immediately before the bibliography section heading, or remove it.",
  },
  function: ({ document }, onError) => {
    const hasSectionData = hasAsciidoctorSections(document);
    for (const block of document.blocks.filter((candidate) => isSpecialBlockOutsideMatchingSection(document, candidate, "bibliography", hasSectionData))) {
      onError({
        severity: "warning",
        message: "[bibliography] should apply to a section heading",
        range: { start: block.range.start },
        fixHelper: "Move `[bibliography]` immediately before the bibliography section heading, or remove it.",
      });
    }
    for (const section of document.sections.filter((candidate) => isSpecialSection(candidate, "bibliography", hasSectionData))) {
      if (section.level === 0 && document.attributes.doctype !== "book") {
        onError({
          severity: "warning",
          message: "Article bibliography should use a level-1 or nested section heading",
          range: { start: section.titleRange.start },
          fixHelper: "Use `==` for an article bibliography heading.",
        });
      }
    }
  },
};
