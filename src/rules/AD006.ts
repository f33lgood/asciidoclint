import path from "node:path";
import type { Rule } from "../types.js";

export const AD006: Rule = {
  id: "AD006",
  alias: "included-document-title",
  description: "Included AsciiDoc files should not introduce a level-0 title without level offset",
  tags: ["core", "include", "headings"],
  parser: "document",
  docs: {
    summary: "Included files should not introduce article level-0 sections unless the include applies leveloffset or intentionally supplies the root document title.",
    rationale: "A level-0 title inside an article include creates an invalid extra level-0 section unless the including document explicitly offsets section levels. Wrapper documents may intentionally use their first include as the root document title, and book documents may intentionally include level-0 parts.",
    fixability: "no",
    fixHelper: "For article parents, add leveloffset to the include or change the included file heading to the section level expected by the parent. Keep the level-0 heading only for wrapper-title includes or doctype=book part files.",
    badExamples: [{ code: "= Root Title\n\ninclude::chapter.adoc[]\n\n// chapter.adoc\n= Chapter Title" }],
    goodExamples: [
      { code: "include::chapter.adoc[leveloffset=+1]\n\n// chapter.adoc\n= Chapter Title" },
      { code: "include::title-page.adoc[]\ninclude::chapter.adoc[]\n\n// title-page.adoc\n= Document Title" },
      { code: ":doctype: book\n\n= Book Title\n\ninclude::part-one.adoc[]\n\n// part-one.adoc\n= Part One\n\n== Chapter One" },
    ],
  },
  function: ({ document }, onError) => {
    const includesWithoutLevelOffset = document.includes
      .filter((include) => include.status === "resolved" && include.resolvedTarget)
      .filter((include) => include.attributes.leveloffset === undefined)
      .map((include) => ({ ...include, resolvedTarget: path.resolve(include.resolvedTarget!) }));
    for (const section of document.sections) {
      const include = includesWithoutLevelOffset.find((record) => record.resolvedTarget === path.resolve(section.range.start.file));
      if (section.level === 0
        && include
        && document.attributes.doctype !== "book"
        && !isRootTitleInclude(document.file, include, section, document.sections)) {
        onError({
          severity: "error",
          message: "Included file starts with a level-0 document title",
          range: section.range,
          fixHelper: "Add leveloffset to the include directive in the parent file or change this included heading to the section level expected by the parent.",
        });
      }
    }
  },
};

function isRootTitleInclude(rootFile: string, include: { range: { start: { file: string; line: number } }; resolvedTarget: string }, section: { range: { start: { file: string } } }, sections: Array<{ level: number; range: { start: { file: string; line: number } } }>): boolean {
  const root = path.resolve(rootFile);
  if (path.resolve(include.range.start.file) !== root) {
    return false;
  }
  const firstLevelZero = sections.find((candidate) => candidate.level === 0);
  if (!firstLevelZero || path.resolve(firstLevelZero.range.start.file) !== path.resolve(section.range.start.file)) {
    return false;
  }
  return !sections.some((candidate) =>
    candidate.level === 0
    && path.resolve(candidate.range.start.file) === root
    && candidate.range.start.line < include.range.start.line,
  );
}
