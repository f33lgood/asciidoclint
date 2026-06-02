import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, loadConfigDetails, loadRules, ruleMetadata } from "./rules.js";
import { initRule } from "../cli/init-rule.js";
import { resolveRuleReference } from "../rules/registry.js";

describe("rule loading and metadata", () => {
  it("keeps per-rule docs beside experimental custom-rule fixtures", () => {
    const fixtureDirectory = path.resolve("test", "fixtures", "experimental-custom-rules");
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
    const configDirectory = path.join(directory, ".asciidoclint");
    const configPath = path.join(configDirectory, "config.yaml");
    fs.mkdirSync(configDirectory);
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

    const { rules } = await loadRules({ configFile: configPath, cwd: directory, noGlobalConfig: true });
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
    const configPath = path.join(configDirectory, "config.yaml");
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

    const { rules } = await loadRules({ configFile: configPath, cwd: root, noGlobalConfig: true });

    expect(resolveRuleReference(rules, "relative-custom-check")?.id).toBe("ORG778");
  });

  it("loads a custom rule package directory", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-rule-package-"));
    const packageDirectory = path.join(root, "lint-rules");
    fs.mkdirSync(path.join(packageDirectory, "src"), { recursive: true });
    fs.writeFileSync(path.join(packageDirectory, "src", "index.mjs"), `export const rules = [{
      id: "ORG779",
      alias: "package-directory-check",
      description: "Loaded from a custom rule package directory",
      tags: ["organization"],
      docs: { summary: "Loaded from the package root." },
      parser: "text",
      function: () => undefined
    }];
    export default rules;`);
    fs.mkdirSync(path.join(root, ".asciidoclint"));
    fs.writeFileSync(path.join(root, ".asciidoclint", "config.yaml"), "customRules:\n  - ./lint-rules\n");

    const { rules } = await loadRules({ cwd: root, noGlobalConfig: true });

    expect(resolveRuleReference(rules, "package-directory-check")?.id).toBe("ORG779");
  });

  it("loads document roots from config", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-documents-config-"));
    const configDirectory = path.join(directory, ".asciidoclint");
    const configPath = path.join(configDirectory, "config.yaml");
    fs.mkdirSync(configDirectory);
    fs.writeFileSync(configPath, [
      "documents:",
      "  - index.adoc",
    ].join("\n"));

    const config = loadConfig(configPath, directory, { noGlobalConfig: true });

    expect(config.documents).toEqual(["index.adoc"]);
  });

  it("merges global config before project config", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-home-"));
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-project-"));
    fs.mkdirSync(path.join(home, ".asciidoclint"), { recursive: true });
    fs.mkdirSync(path.join(root, ".asciidoclint"), { recursive: true });
    fs.writeFileSync(path.join(home, ".asciidoclint", "config.yaml"), [
      "customRules:",
      "  - ./global-rules",
      "rules:",
      "  ORG001:",
      "    severity: warning",
    ].join("\n"));
    fs.writeFileSync(path.join(root, ".asciidoclint", "config.yaml"), [
      "customRules:",
      "  - ./project-rules",
      "rules:",
      "  ORG001:",
      "    severity: error",
    ].join("\n"));

    const { config, sources } = loadConfigDetails({ cwd: root, homeDir: home });

    expect(sources.map((source) => source.kind)).toEqual(["global", "project"]);
    expect(config.customRules).toEqual([
      path.join(home, "global-rules"),
      path.join(root, "project-rules"),
    ]);
    expect(config.rules?.ORG001).toEqual({ severity: "error" });
  });

  it("can skip global config", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-home-"));
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-project-"));
    fs.mkdirSync(path.join(home, ".asciidoclint"), { recursive: true });
    fs.writeFileSync(path.join(home, ".asciidoclint", "config.yaml"), "customRules:\n  - ./global-rules\n");

    const { config, sources } = loadConfigDetails({ cwd: root, homeDir: home, noGlobalConfig: true });

    expect(sources).toEqual([]);
    expect(config.customRules).toBeUndefined();
  });

  it("scaffolds custom rules with id-first filenames", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-init-rule-"));
    const files = initRule({ tag: "org", id: "ORG001", alias: "no-todo", directory });

    expect(files.map((file) => path.relative(directory, file))).toEqual([
      path.join("src", "ORG001-no-todo.js"),
      path.join("src", "index.js"),
      path.join("docs", "ORG001-no-todo.md"),
      "ORG001-no-todo.test.js",
      path.join("fixtures", "ORG001-no-todo", "bad.adoc"),
      path.join("fixtures", "ORG001-no-todo", "good.adoc"),
    ]);
  });

  it("updates custom rule pack index when adding more rules", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-init-rule-pack-"));
    initRule({ tag: "org", id: "ORG001", alias: "no-todo", directory });
    initRule({ tag: "org", id: "ORG002", alias: "section-policy", directory });

    const index = fs.readFileSync(path.join(directory, "src", "index.js"), "utf8");

    expect(index).toContain('import ORG001_no_todo from "./ORG001-no-todo.js";');
    expect(index).toContain('import ORG002_section_policy from "./ORG002-section-policy.js";');
    expect(index).toContain("export const rules = [ORG001_no_todo, ORG002_section_policy];");
    expect(index).toContain("export default rules;");
  });

  it("keeps --pack as a compatibility alias for --tag", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-init-rule-pack-alias-"));
    initRule({ pack: "org", id: "ORG001", alias: "no-todo", directory });

    const source = fs.readFileSync(path.join(directory, "src", "ORG001-no-todo.js"), "utf8");

    expect(source).toContain('tags: ["org"]');
  });
});
