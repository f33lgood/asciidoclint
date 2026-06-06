import type { Rule } from "../types.js";
import { hasAsciidoctorSections, isBook, isSpecialSection, previousNonDocumentTitlePeers } from "./specialSections.js";

export const AD047: Rule = {
  id: "AD047",
  alias: "abstract-placement",
  description: "Abstract sections should match documented article placement",
  tags: ["core", "structure"],
  parser: "document",
  docs: {
    summary: "`[abstract]` sections should be level-1 article sections before normal body sections.",
    rationale: "Asciidoctor documents abstract as an article special section. Asciidoctor.js accepts misplaced and nested abstract markers silently, and in books it normalizes them to ordinary chapters, so linting keeps the source aligned with the documented section contract.",
    badExamples: [{ code: "= Article\n\n== Body\n\n[abstract]\n=== Nested Abstract" }],
    goodExamples: [{ code: "= Article\n\n[abstract]\n== Abstract\n\nSummary.\n\n== Body" }],
    fixability: "no",
    fixHelper: "Use `[abstract]` on a level-1 article section before normal body sections, or remove it.",
  },
  function: ({ document }, onError) => {
    const hasSectionData = hasAsciidoctorSections(document);
    for (const section of document.sections.filter((candidate) => isSpecialSection(candidate, "abstract", hasSectionData))) {
      if (isBook(document)) {
        onError({
          severity: "warning",
          message: "Abstract section is documented for article doctype, not book documents",
          range: { start: section.titleRange.start },
          fixHelper: "Remove `[abstract]` or use an ordinary book chapter if this content belongs in a book.",
        });
        continue;
      }
      if (section.level !== 1) {
        onError({
          severity: "warning",
          message: "Article abstract should use a level-1 section heading",
          range: { start: section.titleRange.start },
          fixHelper: "Use `==` for the article abstract heading.",
        });
        continue;
      }
      if (previousNonDocumentTitlePeers(section, document).length > 0) {
        onError({
          severity: "warning",
          message: "Article abstract should appear before normal body sections",
          range: { start: section.titleRange.start },
          fixHelper: "Move this `[abstract]` section before the first body section, or remove `[abstract]`.",
        });
      }
    }
  },
};
