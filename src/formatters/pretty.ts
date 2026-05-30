import path from "node:path";
import { ruleLabel } from "../rules/builtin.js";
import type { LintFinding, LintResult } from "../types.js";

export function formatPretty(result: LintResult): string {
  if (result.findings.length === 0) {
    return "0 findings";
  }
  const lines: string[] = [];
  for (const finding of result.findings) {
    lines.push(primaryLine(finding));
    if (finding.context) {
      lines.push(`  ${finding.context}`);
    }
    if (finding.fixHelper) {
      lines.push(`  fix helper: ${finding.fixHelper}`);
    }
    lines.push("");
  }
  const summary = result.findings.reduce(
    (counts, finding) => {
      counts.total += 1;
      counts[finding.severity] += 1;
      if (finding.fix?.applicability === "safe") {
        counts.safe += 1;
      }
      if (finding.fix?.applicability === "unsafe") {
        counts.unsafe += 1;
      }
      return counts;
    },
    { total: 0, error: 0, warning: 0, info: 0, safe: 0, unsafe: 0 },
  );
  lines.push(`${summary.total} findings: ${summary.error} errors, ${summary.warning} warnings, ${summary.info} info`);
  if (summary.safe) {
    lines.push(`${summary.safe} safe fixes available; run with --fix to apply them`);
  }
  if (summary.unsafe) {
    lines.push(`${summary.unsafe} unsafe fixes available; run with --fix --unsafe to apply them`);
  }
  return lines.join("\n");
}

function primaryLine(finding: LintFinding): string {
  const file = path.relative(process.cwd(), finding.range.start.file);
  return `${file}:${finding.range.start.line}:${finding.range.start.column} ${ruleLabel(finding)} ${finding.severity} ${finding.message}`;
}
