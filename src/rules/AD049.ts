import type { Rule } from "../types.js";
import { hasAsciidoctorSections, isBook, isSpecialBlockOutsideMatchingSection, isSpecialSection } from "./specialSections.js";

export const AD049: Rule = {
  id: "AD049",
  alias: "glossary-placement",
  description: "Glossary markers should apply to documented glossary section levels",
  tags: ["core", "structure"],
  parser: "document",
  docs: {
    summary: "`[glossary]` should apply to a glossary section at a documented level.",
    rationale: "Asciidoctor documents glossary as a special section style for articles and books. Asciidoctor.js accepts nested or block-applied glossary markers silently, so linting prevents source that looks like a glossary section but does not match the documented structure.",
    badExamples: [{ code: "= Article\n\n== Body\n\n[glossary]\n=== Terms" }],
    goodExamples: [{ code: "= Article\n\n[glossary]\n== Glossary\n\nterm:: Definition." }],
    fixability: "no",
    fixHelper: "Use `[glossary]` before a level-1 glossary section, or a level-0 glossary only when it is adjacent to book parts.",
  },
  function: ({ document }, onError) => {
    const hasSectionData = hasAsciidoctorSections(document);
    for (const block of document.blocks.filter((candidate) => isSpecialBlockOutsideMatchingSection(document, candidate, "glossary", hasSectionData))) {
      onError({
        severity: "warning",
        message: "[glossary] should apply to a section heading",
        range: { start: block.range.start },
        fixHelper: "Move `[glossary]` immediately before the glossary section heading, or remove it.",
      });
    }
    for (const section of document.sections.filter((candidate) => isSpecialSection(candidate, "glossary", hasSectionData))) {
      if (!isBook(document) && section.level !== 1) {
        onError({
          severity: "warning",
          message: "Article glossary should use a level-1 section heading",
          range: { start: section.titleRange.start },
          fixHelper: "Use `==` for an article glossary heading.",
        });
        continue;
      }
      if (isBook(document) && section.level > 1) {
        onError({
          severity: "warning",
          message: "Book glossary should use a level-0 or level-1 section heading, not a nested subsection",
          range: { start: section.titleRange.start },
          fixHelper: "Move `[glossary]` to the glossary section heading, or remove it from this nested subsection.",
        });
      }
    }
  },
};
