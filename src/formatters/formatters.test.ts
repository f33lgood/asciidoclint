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
    const parsed = JSON.parse(formatJson(result)) as {
      files: string[];
      findings: Array<{ range: { start: { file: string }; end?: { file: string } } }>;
      summary: { total: number; error: number };
    };

    expect(parsed.files).toEqual([path.relative(process.cwd(), file)]);
    expect(parsed.findings[0]?.range.start.file).toBe(path.relative(process.cwd(), file));
    expect(parsed.findings[0]?.range.end?.file).toBe(path.relative(process.cwd(), file));
    expect(parsed.summary).toMatchObject({ total: 1, error: 1 });
  });
});
