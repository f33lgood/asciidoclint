import type { Rule } from "../types.js";

export const AD027: Rule = {
  id: "AD027",
  alias: "missing-local-link",
  description: "Local link targets should resolve to existing files",
  tags: ["dependencies", "links"],
  parser: "dependency",
  docs: {
    summary: "Local link: targets should resolve to existing files.",
    rationale: "Asciidoctor renders relative link: targets without checking the target file. A missing local target becomes a broken link in the published document.",
    fixability: "no",
    fixHelper: "Create the linked file, fix the local link target, or change the target to an xref or URL when that is the intended link type.",
    badExamples: [{ code: "link:missing.pdf[Download]" }],
    goodExamples: [
      { code: "link:datasheet.pdf[Download]" },
      { code: "link:tools.html#editors[Editors]" },
      { code: "https://example.com/downloads/report.pdf[Download]" },
    ],
  },
  function: ({ dependencies }, onError) => {
    for (const record of dependencies.records) {
      if (record.type === "attachment" && record.status === "missing") {
        onError({
          severity: "error",
          message: `Missing local link target: ${record.target}`,
          range: record.range,
          fixHelper: "Create the linked file, fix the local link target, or use xref:/URL syntax if this is not a local file link.",
        });
      }
    }
  },
};
