import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { builtInRules } from "./builtin.js";
import { validateRules } from "./registry.js";
import type { Rule } from "../types.js";

describe("rule registry", () => {
  it("validates built-in rule metadata", () => {
    expect(() => validateRules(builtInRules)).not.toThrow();
    expect(builtInRules).toHaveLength(61);
  });

  it("has a rule documentation page for every built-in rule", () => {
    for (const rule of builtInRules) {
      const docsPath = path.resolve("docs", "rules", `${rule.id}.md`);
      expect(fs.existsSync(docsPath), `${rule.id} docs should exist`).toBe(true);
      const docs = fs.readFileSync(docsPath, "utf8");
      expect(docs).toContain(rule.id);
      expect(docs).toContain(rule.alias);
    }
  });

  it("has rendering or documentation necessity rationale for every built-in rule", () => {
    const report = fs.readFileSync(path.resolve("docs", "rules", "rule-necessity.md"), "utf8");

    for (const rule of builtInRules) {
      expect(report, `${rule.id} should be included in rule necessity report`).toContain(`\`${rule.id}/${rule.alias}\``);
    }
    expect(report).toContain("the structure can break or materially change AsciiDoc rendering");
    expect(report).toContain("Severity is assigned from rendering impact");
  });

  it("keeps waiver diagnostic IDs in the built-in rule contract", () => {
    const waiverIds = ["ADW01", "ADW02", "ADW03", "ADW04", "ADW05", "ADW06", "ADW07", "ADW08"];
    const builtInIds = new Set(builtInRules.map((rule) => rule.id));

    for (const id of waiverIds) {
      expect(builtInIds.has(id), `${id} should have built-in rule metadata`).toBe(true);
    }
  });

  it("rejects duplicate aliases", () => {
    const base: Rule = {
      id: "ORG001",
      alias: "same",
      description: "test",
      tags: ["test"],
      docs: { summary: "test" },
      parser: "text",
      function: () => undefined,
    };
    expect(() => validateRules([base, { ...base, id: "ORG002" }])).toThrow(/Duplicate rule alias/);
  });
});
