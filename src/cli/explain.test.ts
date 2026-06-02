import { describe, expect, it } from "vitest";
import { ruleMetadata } from "../api/rules.js";
import { AD001 } from "../rules/AD001.js";
import { formatRuleExplanation } from "./explain.js";

describe("rule explanations", () => {
  it("formats a rule as readable terminal help", () => {
    expect(formatRuleExplanation(AD001)).toBe([
      "AD001 heading-level-progression",
      "",
      "Section headings must not skip levels",
      "",
      "Parser: document",
      "Tags: core, headings",
      "Fixability: no",
      "",
      "Summary:",
      "A heading should advance by at most one level from the previous heading.",
      "",
      "Why it matters:",
      "Skipped levels usually indicate a broken document hierarchy.",
      "",
      "How to fix:",
      "Add the missing intermediate parent section, or reduce the skipped heading marker so the section advances by only one level from the previous section.",
      "",
      "Bad:",
      "= Title\n\n=== Skipped",
      "",
      "Good:",
      "= Title\n\n== Parent\n\n=== Child",
      "",
      "More:",
      "docs/rules/AD001.md",
      "",
    ].join("\n"));
  });

  it("keeps structured metadata available for json output", () => {
    expect(ruleMetadata(AD001)).toMatchObject({
      id: "AD001",
      alias: "heading-level-progression",
      docs: {
        fixHelper: "Add the missing intermediate parent section, or reduce the skipped heading marker so the section advances by only one level from the previous section.",
      },
    });
  });
});
