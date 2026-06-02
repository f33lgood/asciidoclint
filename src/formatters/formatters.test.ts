import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatJson } from "./json.js";
import { formatPretty } from "./pretty.js";
import type { LintResult } from "../types.js";

const file = path.resolve("fixtures", "doc.adoc");

const result: LintResult = {
  files: [file],
  findings: [
    {
      ruleId: "AD001",
      alias: "heading-level-progression",
      severity: "error",
      message: "Skipped section level",
      range: {
        start: { file, line: 3, column: 1 },
        end: { file, line: 3, column: 12 },
      },
      context: "=== Skipped",
      fixHelper: "Add the missing parent section.",
      fix: {
        applicability: "safe",
        edits: [],
      },
    },
  ],
};

const waivedResult: LintResult = {
  files: [file],
  findings: [
    ...result.findings,
    {
      ruleId: "AD023",
      alias: "empty-section",
      severity: "info",
      message: "Section has no body content or child sections",
      range: {
        start: { file, line: 8, column: 1 },
      },
      waived: true,
      waiver: {
        file,
        line: 7,
        column: 1,
        directive: "disable-next-line",
        rules: ["AD023"],
        reason: "intentional placeholder",
      },
    },
  ],
};

describe("formatters", () => {
  it("renders pretty output with rule labels, fix helper, and fix summary", () => {
    const output = formatPretty(result);

    expect(output).toContain("AD001/heading-level-progression error Skipped section level");
    expect(output).toContain("fix helper: Add the missing parent section.");
    expect(output).toContain("1 safe fixes available");
  });

  it("renders zero-finding pretty output", () => {
    expect(formatPretty({ files: [file], findings: [] })).toBe("0 findings");
  });

  it("renders JSON output with relative files and summary counts", () => {
    const parsed = JSON.parse(formatJson(waivedResult)) as {
      files: string[];
      findings: Array<{ range: { start: { file: string }; end?: { file: string } }; waiver?: { file: string } }>;
      summary: { total: number; error: number; waived: number };
    };

    expect(parsed.files).toEqual([path.relative(process.cwd(), file)]);
    expect(parsed.findings[0]?.range.start.file).toBe(path.relative(process.cwd(), file));
    expect(parsed.findings[0]?.range.end?.file).toBe(path.relative(process.cwd(), file));
    expect(parsed.findings[1]?.waiver?.file).toBe(path.relative(process.cwd(), file));
    expect(parsed.summary).toMatchObject({ total: 1, error: 1, waived: 1 });
  });

  it("hides waived findings in pretty output and counts them in the summary", () => {
    const output = formatPretty(waivedResult);

    expect(output).toContain("1 findings: 1 errors, 0 warnings, 0 info (1 waived)");
    expect(output).not.toContain("AD023/empty-section");
  });

  it("renders zero active findings with waived count", () => {
    expect(formatPretty({ files: [file], findings: [waivedResult.findings[1]!] })).toBe("0 findings (1 waived)");
  });
});
