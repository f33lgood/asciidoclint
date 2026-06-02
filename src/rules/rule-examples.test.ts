import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lintFiles } from "../api/lint.js";
import { builtInRules } from "./builtin.js";

describe("built-in rule examples", () => {
  for (const rule of builtInRules) {
    const badExample = rule.docs?.badExamples?.[0]?.code;
    const maybeIt = badExample === undefined ? it.skip : it;
    maybeIt(`${rule.id}/${rule.alias ?? "unnamed"} reports its documented bad example`, async () => {
      const directory = exampleDirectory(rule.id, "bad");
      writeExample(directory, rule.id, "bad", badExample ?? "");

      const result = await lintFiles(["doc.adoc"], { cwd: directory, configFile: writeOnlyRuleConfig(directory, rule.id) });

      expect(result.findings.some((finding) => finding.ruleId === rule.id)).toBe(true);
    });

    it(`${rule.id}/${rule.alias ?? "unnamed"} accepts its documented good example`, async () => {
      const directory = exampleDirectory(rule.id, "good");
      writeExample(directory, rule.id, "good", rule.docs?.goodExamples?.[0]?.code ?? "");

      const result = await lintFiles(["doc.adoc"], { cwd: directory, configFile: writeOnlyRuleConfig(directory, rule.id) });

      expect(result.findings.some((finding) => finding.ruleId === rule.id)).toBe(false);
    });
  }
});

function exampleDirectory(ruleId: string, kind: "bad" | "good"): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `asciidoclint-${ruleId}-${kind}-`));
}

function writeOnlyRuleConfig(directory: string, enabledRuleId: string): string {
  const configFile = path.join(directory, ".asciidoclint", "config.yaml");
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  const lines = ["rules:"];
  for (const rule of builtInRules) {
    lines.push(`  ${rule.id}: ${rule.id === enabledRuleId ? "true" : "false"}`);
  }
  fs.writeFileSync(configFile, `${lines.join("\n")}\n`);
  return configFile;
}

function writeExample(directory: string, ruleId: string, kind: "bad" | "good", code: string): void {
  switch (ruleId) {
    case "AD006":
      fs.writeFileSync(path.join(directory, "chapter.adoc"), "= Chapter Title\n");
      fs.writeFileSync(path.join(directory, "doc.adoc"), kind === "bad" ? "= Root Title\n\ninclude::chapter.adoc[]\n" : "include::chapter.adoc[leveloffset=+1]\n");
      return;
    case "AD022":
      writeIncludeHierarchyExample(directory, kind);
      return;
    case "AD024":
      if (kind === "good") {
        fs.writeFileSync(path.join(directory, "chapter.adoc"), "== Chapter\n");
      }
      break;
    case "AD025":
      if (kind === "good") {
        fs.writeFileSync(path.join(directory, "diagram.png"), "png");
      }
      break;
    case "AD027":
      if (kind === "good") {
        fs.writeFileSync(path.join(directory, "datasheet.pdf"), "pdf");
      }
      break;
    case "AD044":
      fs.writeFileSync(path.join(directory, "chapter.adoc"), "[#setup]\n== Setup\n");
      break;
    default:
      break;
  }
  fs.writeFileSync(path.join(directory, "doc.adoc"), `${code}\n`);
}

function writeIncludeHierarchyExample(directory: string, kind: "bad" | "good"): void {
  if (kind === "bad") {
    fs.writeFileSync(path.join(directory, "doc.adoc"), "include::a.adoc[]\n");
    fs.writeFileSync(path.join(directory, "a.adoc"), "include::doc.adoc[]\n");
    return;
  }
  fs.writeFileSync(path.join(directory, "doc.adoc"), "include::chapter.adoc[]\ninclude::appendix.adoc[]\n");
  fs.writeFileSync(path.join(directory, "chapter.adoc"), "== Chapter\n");
  fs.writeFileSync(path.join(directory, "appendix.adoc"), "== Appendix\n");
}
