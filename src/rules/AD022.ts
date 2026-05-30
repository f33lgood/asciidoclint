import type { Rule } from "../types.js";
import type { SourceRange } from "../types.js";

interface IncludeEdge {
  target: string;
  range: SourceRange;
}

export const AD022: Rule = {
  id: "AD022",
  alias: "circular-include",
  description: "Include trees must not contain cycles",
  tags: ["core", "includes", "structure"],
  parser: "project",
  docs: {
    summary: "Include trees should not be circular.",
    rationale: "Asciidoctor stops circular include expansion only after the include-depth limit is exceeded; reporting the actual cycle gives authors a direct repair target.",
    fixability: "no",
    fixHelper: "Remove one include from the reported cycle, or replace one edge with an xref or a smaller shared partial that does not include its parent.",
    badExamples: [{ code: "include::a.adoc[]\n// a.adoc includes this file again" }],
    goodExamples: [{ code: "include::chapter.adoc[]\ninclude::appendix.adoc[]" }],
  },
  function: ({ file, document }, onError) => {
    const reportedCycles = new Set<string>();
    const explored = new Set<string>();
    const graph = new Map<string, IncludeEdge[]>();
    for (const include of document.includes) {
      if (include.status !== "resolved" || !include.resolvedTarget) {
        continue;
      }
      const source = include.range.start.file;
      const targets = graph.get(source) ?? [];
      targets.push({ target: include.resolvedTarget, range: include.range });
      graph.set(source, targets);
    }
    const root = document.file || file;
    visit(root, [root]);

    function visit(current: string, stack: string[]): void {
      if (explored.has(current)) {
        return;
      }
      for (const edge of graph.get(current) ?? []) {
        const cycleStart = stack.indexOf(edge.target);
        if (cycleStart !== -1) {
          const cycle = [...stack.slice(cycleStart), edge.target].join(" -> ");
          if (!reportedCycles.has(cycle)) {
            reportedCycles.add(cycle);
            onError({
              severity: "error",
              message: "Circular include detected",
              detail: cycle,
              range: edge.range,
              fixHelper: "Remove one include from the reported cycle, or replace one edge with an xref or a shared partial.",
            });
          }
          continue;
        }
        visit(edge.target, [...stack, edge.target]);
      }
      explored.add(current);
    }
  },
};
