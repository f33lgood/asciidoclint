import type { BlockNode, NormalizedDocument, SectionNode } from "../types.js";

export const specialSectionStyles = [
  "abstract",
  "colophon",
  "dedication",
  "acknowledgments",
  "preface",
  "partintro",
  "appendix",
  "glossary",
  "bibliography",
  "index",
] as const;

export type SpecialSectionStyle = typeof specialSectionStyles[number];

export function hasAsciidoctorSections(document: NormalizedDocument): boolean {
  return document.sections.some((section) => section.source === "asciidoctor");
}

export function isSpecialSection(section: SectionNode, style: SpecialSectionStyle, hasAsciidoctorSectionData: boolean): boolean {
  return section.sectname === style
    || (section.source === "asciidoctor" && section.style === style)
    || (!hasAsciidoctorSectionData && section.style === style);
}

export function isSpecialBlock(block: BlockNode, style: SpecialSectionStyle): boolean {
  return block.style === style && block.context !== "section";
}

export function isSpecialBlockOutsideMatchingSection(
  document: NormalizedDocument,
  block: BlockNode,
  style: SpecialSectionStyle,
  hasAsciidoctorSectionData: boolean,
): boolean {
  if (!isSpecialBlock(block, style)) {
    return false;
  }
  const section = nearestPrecedingSection(document, block);
  return !section || !isSpecialSection(section, style, hasAsciidoctorSectionData);
}

export function isBook(document: NormalizedDocument): boolean {
  return document.attributes.doctype === "book";
}

export function isDocumentTitle(section: SectionNode, document: NormalizedDocument): boolean {
  return document.sections[0] === section && section.level === 0;
}

export function previousPeerSections(section: SectionNode, document: NormalizedDocument): SectionNode[] {
  const siblings = section.parent ? section.parent.children : document.sections;
  const index = siblings.indexOf(section);
  return index > 0 ? siblings.slice(0, index) : [];
}

export function previousNonDocumentTitlePeers(section: SectionNode, document: NormalizedDocument): SectionNode[] {
  return previousPeerSections(section, document).filter((candidate) => !isDocumentTitle(candidate, document));
}

export function nearestPrecedingSection(document: NormalizedDocument, block: BlockNode): SectionNode | undefined {
  return document.sections
    .filter((section) => (
      section.range.start.file === block.range.start.file
      && section.titleRange.start.line < block.range.start.line
      && !isDocumentTitle(section, document)
    ))
    .sort((left, right) => right.titleRange.start.line - left.titleRange.start.line)[0];
}

export function hasChildSectionBeforeLine(section: SectionNode, line: number): boolean {
  return section.children.some((child) => child.titleRange.start.line < line);
}
