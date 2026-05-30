import path from "node:path";
import type { LintResult } from "../types.js";

export function formatJson(result: LintResult): string {
  return JSON.stringify({
    files: result.files.map((file) => path.relative(process.cwd(), file)),
    findings: result.findings.map((finding) => ({
      ...finding,
      range: {
        ...finding.range,
        start: {
          ...finding.range.start,
          file: path.relative(process.cwd(), finding.range.start.file),
        },
        end: finding.range.end
          ? {
              ...finding.range.end,
              file: path.relative(process.cwd(), finding.range.end.file),
            }
          : undefined,
      },
    })),
    summary: summarize(result),
  }, null, 2);
}

function summarize(result: LintResult): Record<string, number> {
  return result.findings.reduce(
    (summary, finding) => {
      summary.total += 1;
      summary[finding.severity] += 1;
      return summary;
    },
    { total: 0, error: 0, warning: 0, info: 0 },
  );
}

