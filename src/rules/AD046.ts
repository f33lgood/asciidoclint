import type { BlockNode, Rule, SectionNode } from "../types.js";

export const AD046: Rule = {
  id: "AD046",
  alias: "preface-placement",
  description: "Preface sections should match documented book placement",
  tags: ["core", "structure"],
  parser: "document",
  docs: {
    summary: "A `[preface]` section should only be used in book documents, should appear at a documented section level, and should precede normal chapters in its book or book part.",
    rationale: "Asciidoctor documents preface as a book special section. Asciidoctor.js accepts misplaced or nested prefaces silently, but still renders them as unnumbered special sections, so a misplaced marker can change numbering and document semantics without a processor diagnostic.",
    badExamples: [
      { code: "= Article\n\n[preface]\n== Notices" },
      { code: "= Book\n:doctype: book\n\n== Chapter\n\n[preface]\n== Preface" },
      { code: "= Book\n:doctype: book\n\n== Chapter\n\n[preface]\n=== Nested Preface" },
    ],
    goodExamples: [
      { code: "= Book\n:doctype: book\n\n[preface]\n== Preface\n\n== Chapter" },
      { code: "= Book\n:doctype: book\n\n= Part One\n\n[preface]\n== Part Preface\n\n== Chapter" },
    ],
    fixability: "no",
    fixHelper: "Use `[preface]` only in book documents. Move a book preface before the first chapter, move a part preface to the first section in its part, and remove `[preface]` from nested subsections.",
  },
  function: ({ document }, onError) => {
    const isBook = document.attributes.doctype === "book";
    const hasAsciidoctorSections = document.sections.some((section) => section.source === "asciidoctor");
    for (const block of document.blocks.filter(isPrefaceBlock)) {
      onError({
        severity: "warning",
        message: "[preface] should apply to a section heading",
        range: { start: block.range.start },
        fixHelper: "Move `[preface]` immediately before the preface section heading, or remove it if this is not a preface section.",
      });
    }

    for (const section of document.sections.filter((candidate) => isPreface(candidate, hasAsciidoctorSections))) {
      if (!isBook) {
        onError({
          severity: "warning",
          message: "Preface section is documented for book doctype, not article documents",
          range: { start: section.titleRange.start },
          fixHelper: "Remove `[preface]`, change the document to `:doctype: book`, or use a special section style documented for article documents.",
        });
        continue;
      }

      if (section.level > 1) {
        onError({
          severity: "warning",
          message: "Preface section should be level 0 or level 1, not a nested subsection",
          range: { start: section.titleRange.start },
          fixHelper: "Remove `[preface]` from this nested subsection, or move `[preface]` to the containing `==` section if that whole section is the preface.",
        });
        continue;
      }

      if (section.parent && section.parent.level === 0) {
        const parentIsDocumentTitle = document.sections[0] === section.parent;
        const misplaced = parentIsDocumentTitle
          ? precedingPeerSection(section, section.parent.children, hasAsciidoctorSections)
          : section.parent.children[0] !== section;
        if (misplaced) {
          onError({
            severity: "warning",
            message: parentIsDocumentTitle
              ? "Book preface should appear before normal chapters"
              : "Part preface should be the first section in its part",
            range: { start: section.titleRange.start },
            fixHelper: parentIsDocumentTitle
              ? "Move this `[preface]` section before the first chapter, or remove `[preface]` if this content belongs in the body."
              : "Move this `[preface]` section before the first chapter in the part, or remove `[preface]` if this content belongs in the body.",
          });
        }
        continue;
      }

      if (!section.parent && precedingPeerSection(section, document.sections, hasAsciidoctorSections)) {
        onError({
          severity: "warning",
          message: "Book preface should appear before normal chapters",
          range: { start: section.titleRange.start },
          fixHelper: "Move this `[preface]` section before the first chapter, or remove `[preface]` if this content belongs in the body.",
        });
      }
    }
  },
};

function isPreface(section: SectionNode, hasAsciidoctorSections = false): boolean {
  return section.sectname === "preface" || (!hasAsciidoctorSections && section.style === "preface");
}

function isPrefaceBlock(block: BlockNode): boolean {
  return block.style === "preface" && block.context !== "section";
}

function precedingPeerSection(section: SectionNode, siblings: SectionNode[], hasAsciidoctorSections: boolean): boolean {
  const index = siblings.indexOf(section);
  return siblings.slice(0, index).some((sibling) => !isPreface(sibling, hasAsciidoctorSections));
}
