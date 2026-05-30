import type { Rule } from "../types.js";
import type { NormalizedDocument, SectionNode } from "../types.js";
import { parseAsciiDocAnchor } from "./utils.js";

export const AD023: Rule = {
  id: "AD023",
  alias: "empty-section",
  description: "Sections should contain body content or child sections",
  tags: ["core", "structure", "references"],
  parser: "document",
  docs: {
    summary: "Sections should not be empty.",
    rationale: "Asciidoctor accepts empty sections and creates section IDs for them, but visible empty outline nodes are usually conversion residue or unfinished structure.",
    fixability: "no",
    fixHelper: "Add body content, add a child section that belongs under this heading, or remove the empty section if it is only conversion/bookmark residue.",
    badExamples: [{ code: "== Empty\n\n== Next" }],
    goodExamples: [
      { code: "== Overview\n\nContent." },
      { code: "== Container\n\n=== Child\n\nContent." },
    ],
  },
  function: ({ document }, onError) => {
    for (const section of document.sections) {
      if (section.level === 0 || section.children.length > 0 || hasSectionBodyContent(document, section)) {
        continue;
      }
      onError({
        severity: "info",
        message: "Section has no body content or child sections",
        range: section.titleRange,
        fixHelper: "Add body content, add a child section, or remove the empty section if it is only conversion/bookmark residue.",
      });
    }
  },
};

function hasSectionBodyContent(document: NormalizedDocument, section: SectionNode): boolean {
  const file = document.files.find((candidate) => candidate.file === section.titleRange.start.file);
  if (!file) {
    return false;
  }
  const startLine = section.titleRange.start.line + 1;
  const endLine = nextSiblingOrAncestorLine(document, section) ?? file.lines.length + 1;
  for (let lineNumber = startLine; lineNumber < endLine; lineNumber += 1) {
    const line = file.lines[lineNumber - 1] ?? "";
    if (isBodyContentLine(line)) {
      return true;
    }
  }
  return false;
}

function nextSiblingOrAncestorLine(document: NormalizedDocument, section: SectionNode): number | undefined {
  return document.sections
    .filter((candidate) => candidate.titleRange.start.file === section.titleRange.start.file)
    .filter((candidate) => candidate.titleRange.start.line > section.titleRange.start.line)
    .filter((candidate) => candidate.level <= section.level)
    .sort((left, right) => left.titleRange.start.line - right.titleRange.start.line)[0]
    ?.titleRange.start.line;
}

function isBodyContentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed !== "" && !trimmed.startsWith("//") && !parseAsciiDocAnchor(line);
}
