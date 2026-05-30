import type { Rule } from "../types.js";

export const AD024: Rule = {
  id: "AD024",
  alias: "missing-include",
  description: "Include targets should exist after attribute substitution",
  tags: ["dependencies", "include"],
  parser: "dependency",
  docs: {
    summary: "include:: targets should resolve to an existing file.",
    rationale: "Asciidoctor reports missing required includes as parser diagnostics and renders an unresolved directive. AD024 reports the same dependency failure through the normalized dependency graph so it is configurable and available even when users focus on dependency rules.",
    fixability: "no",
    fixHelper: "Create the included file, fix the include target or attribute value, or mark the include optional when it is intentionally absent.",
    badExamples: [{ code: "include::{chapter-file}[]" }],
    goodExamples: [
      { code: ":chapter-file: chapter.adoc\ninclude::{chapter-file}[]" },
      { code: "include::optional-chapter.adoc[opts=optional]" },
    ],
  },
  function: ({ dependencies }, onError) => {
    for (const record of dependencies.records) {
      if (record.type === "include" && record.status === "missing") {
        onError({
          severity: "error",
          message: `Missing include target: ${record.target}`,
          range: record.range,
          fixHelper: "Create the included file, fix the include path or attribute value, or add opts=optional if the missing include is intentional.",
        });
      }
    }
  },
};
