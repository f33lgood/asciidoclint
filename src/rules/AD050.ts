import type { Rule } from "../types.js";
import { hasAsciidoctorSections, isBook, isSpecialBlockOutsideMatchingSection, isSpecialSection } from "./specialSections.js";

export const AD050: Rule = {
  id: "AD050",
  alias: "index-placement",
  description: "Index markers should apply to documented index section levels",
  tags: ["core", "structure"],
  parser: "document",
  docs: {
    summary: "`[index]` should apply to an index section at a documented level.",
    rationale: "Asciidoctor documents index as a special section style for articles and books. Asciidoctor.js accepts nested or block-applied index markers silently, so linting keeps index source aligned with documented generated-index placement.",
    badExamples: [{ code: "= Article\n\n== Body\n\n[index]\n=== Index" }],
    goodExamples: [{ code: "= Article\n\n[index]\n== Index" }],
    fixability: "no",
    fixHelper: "Use `[index]` before a level-1 index section, or a level-0 index only when it is adjacent to book parts.",
  },
  function: ({ document }, onError) => {
    const hasSectionData = hasAsciidoctorSections(document);
    for (const block of document.blocks.filter((candidate) => isSpecialBlockOutsideMatchingSection(document, candidate, "index", hasSectionData))) {
      onError({
        severity: "warning",
        message: "[index] should apply to a section heading",
        range: { start: block.range.start },
        fixHelper: "Move `[index]` immediately before the index section heading, or remove it.",
      });
    }
    for (const section of document.sections.filter((candidate) => isSpecialSection(candidate, "index", hasSectionData))) {
      if (!isBook(document) && section.level !== 1) {
        onError({
          severity: "warning",
          message: "Article index should use a level-1 section heading",
          range: { start: section.titleRange.start },
          fixHelper: "Use `==` for an article index heading.",
        });
        continue;
      }
      if (isBook(document) && section.level > 1) {
        onError({
          severity: "warning",
          message: "Book index should use a level-0 or level-1 section heading, not a nested subsection",
          range: { start: section.titleRange.start },
          fixHelper: "Move `[index]` to the index section heading, or remove it from this nested subsection.",
        });
      }
    }
  },
};
