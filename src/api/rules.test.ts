import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, loadRules, ruleMetadata } from "./rules.js";
import { initRule } from "../cli/init-rule.js";
import { resolveRuleReference } from "../rules/registry.js";

describe("rule loading and metadata", () => {
  it("keeps per-rule docs beside custom-rule fixtures", () => {
    const fixtureDirectory = path.resolve("test", "fixtures", "custom-rules");
    const readme = fs.readFileSync(path.join(fixtureDirectory, "README.md"), "utf8");
    const sourceDirectory = path.join(fixtureDirectory, "src");
    const docsDirectory = path.join(fixtureDirectory, "docs");
    const ruleFiles = fs.readdirSync(sourceDirectory).filter((file) => /^ORG\d{3}-.+\.ts$/.test(file)).sort();

    expect(readme).toContain("experimental custom-rule fixtures");
    expect(readme).toContain("not official `asciidoclint` extensions");
    expect(ruleFiles.length).toBeGreaterThan(0);
    for (const ruleFile of ruleFiles) {
      const docFile = ruleFile.replace(/\.ts$/, ".md");
      const source = fs.readFileSync(path.join(sourceDirectory, ruleFile), "utf8");
      const docs = fs.readFileSync(path.join(docsDirectory, docFile), "utf8");
      const id = source.match(/id:\s*"([^"]+)"/)?.[1];
      const alias = source.match(/alias:\s*"([^"]+)"/)?.[1];

      expect(id, `${ruleFile} should declare an id`).toBeTruthy();
      expect(alias, `${ruleFile} should declare an alias`).toBeTruthy();
      expect(docs, `${docFile} should mention the rule id`).toContain(`# ${id} - ${alias}`);
      expect(docs, `${docFile} should document the rule description`).toContain("Description:");
      expect(docs, `${docFile} should document necessity`).toContain("Necessity:");
      expect(docs, `${docFile} should document rationale`).toContain("Rationale:");
      expect(docs, `${docFile} should document a bad example`).toContain("Bad:");
      expect(docs, `${docFile} should explain what is wrong`).toContain("What's wrong:");
      expect(docs, `${docFile} should document a good example`).toContain("Good:");
      expect(docs, `${docFile} should explain expected syntax`).toContain("Expected:");
      expect(docs, `${docFile} should explain implementation notes`).toContain("Implementation note:");
    }
  });

  it("loads custom rules for list/explain style metadata", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-rules-"));
    const rulePath = path.join(directory, "custom-rule.mjs");
    const configPath = path.join(directory, ".asciidoclint.yaml");
    fs.writeFileSync(rulePath, `export default {
      id: "ORG777",
      alias: "custom-check",
      description: "Custom check",
      tags: ["organization"],
      docs: {
        summary: "A custom rule used by this project.",
        badExamples: [{ code: "bad" }],
        goodExamples: [{ code: "good" }]
      },
      parser: "text",
      function: () => undefined
    };`);
    fs.writeFileSync(configPath, "customRules:\n  - ./custom-rule.mjs\n");

    const { rules } = await loadRules({ configFile: configPath, cwd: directory });
    const custom = resolveRuleReference(rules, "custom-check");

    expect(custom?.id).toBe("ORG777");
    expect(ruleMetadata(custom!)).toMatchObject({
      id: "ORG777",
      alias: "custom-check",
      description: "Custom check",
      docs: { summary: "A custom rule used by this project." },
    });
  });

  it("resolves config customRules relative to the config file", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-rule-root-"));
    const configDirectory = path.join(root, "config");
    fs.mkdirSync(configDirectory);
    const rulePath = path.join(configDirectory, "custom-rule.mjs");
    const configPath = path.join(configDirectory, ".asciidoclint.yaml");
    fs.writeFileSync(rulePath, `export default {
      id: "ORG778",
      alias: "relative-custom-check",
      description: "Relative custom check",
      tags: ["organization"],
      docs: { summary: "Loaded relative to the config file." },
      parser: "text",
      function: () => undefined
    };`);
    fs.writeFileSync(configPath, "customRules:\n  - ./custom-rule.mjs\n");

    const { rules } = await loadRules({ configFile: configPath, cwd: root });

    expect(resolveRuleReference(rules, "relative-custom-check")?.id).toBe("ORG778");
  });

  it("loads document roots and editor settings from config", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-documents-config-"));
    const configPath = path.join(directory, ".asciidoclint.yaml");
    fs.writeFileSync(configPath, [
      "documents:",
      "  - index.adoc",
      "editor:",
      "  defaultScope: document",
      "  lintOnSave: true",
      "  followSymlinks: false",
      "  importCliDiagnostics: true",
    ].join("\n"));

    const config = loadConfig(configPath, directory);

    expect(config.documents).toEqual(["index.adoc"]);
    expect(config.editor).toEqual({
      defaultScope: "document",
      lintOnSave: true,
      followSymlinks: false,
      importCliDiagnostics: true,
    });
  });

  it("scaffolds custom rules with id-first filenames", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-init-rule-"));
    const files = initRule({ pack: "org", id: "ORG001", alias: "no-todo", directory });

    expect(files.map((file) => path.relative(directory, file))).toEqual([
      "ORG001-no-todo.ts",
      "ORG001-no-todo.test.ts",
      path.join("fixtures", "ORG001-no-todo", "bad.adoc"),
      path.join("fixtures", "ORG001-no-todo", "good.adoc"),
    ]);
  });
});
