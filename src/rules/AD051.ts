import type { Rule } from "../types.js";
import {
  hasAsciidoctorSections,
  hasChildSectionBeforeLine,
  isBook,
  isSpecialBlock,
  isSpecialSection,
} from "./specialSections.js";

export const AD051: Rule = {
  id: "AD051",
  alias: "partintro-placement",
  description: "Part introduction markers should apply to the introductory block of a book part",
  tags: ["core", "structure"],
  parser: "document",
  docs: {
    summary: "`[partintro]` should apply to the introductory block before the first section in a book part.",
    rationale: "Asciidoctor documents partintro as a book part introduction block, not as a free-standing section style. Asciidoctor.js accepts `[partintro]` on sections and outside parts, so linting prevents a marker that renders with special semantics in an undocumented position.",
    badExamples: [{ code: "= Book\n:doctype: book\n\n= Part One\n\n== Chapter\n\n[partintro]\nIntro text." }],
    goodExamples: [{ code: "= Book\n:doctype: book\n\n= Part One\n\n[partintro]\nIntro text.\n\n== Chapter" }],
    fixability: "no",
    fixHelper: "Use `[partintro]` on the introductory paragraph or open block before the first section in a book part.",
  },
  function: ({ document }, onError) => {
    const hasSectionData = hasAsciidoctorSections(document);
    for (const section of document.sections.filter((candidate) => isSpecialSection(candidate, "partintro", hasSectionData))) {
      onError({
        severity: "warning",
        message: "[partintro] should apply to a block inside a book part, not a section heading",
        range: { start: section.titleRange.start },
        fixHelper: "Move `[partintro]` to the introductory paragraph or open block before the part's first section.",
      });
    }
    for (const block of document.blocks.filter((candidate) => isSpecialBlock(candidate, "partintro"))) {
      const part = document.sections
        .filter((section) => (
          section.range.start.file === block.range.start.file
          && section.titleRange.start.line < block.range.start.line
          && section.level === 0
          && section.sectname === "part"
        ))
        .sort((left, right) => right.titleRange.start.line - left.titleRange.start.line)[0];
      if (!isBook(document) || !part || part.level !== 0 || part.sectname !== "part") {
        onError({
          severity: "warning",
          message: "[partintro] should appear inside a book part",
          range: { start: block.range.start },
          fixHelper: "Move this `[partintro]` block after a level-0 book part heading, or remove `[partintro]`.",
        });
        continue;
      }
      if (hasChildSectionBeforeLine(part, block.range.start.line)) {
        onError({
          severity: "warning",
          message: "[partintro] should appear before the first section in its part",
          range: { start: block.range.start },
          fixHelper: "Move this `[partintro]` block before the first chapter or section in the part.",
        });
      }
    }
  },
};
