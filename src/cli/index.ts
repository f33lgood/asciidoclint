#!/usr/bin/env node
import { Command } from "commander";
import { lintFiles } from "../api/lint.js";
import { loadRules, ruleMetadata } from "../api/rules.js";
import { formatJson } from "../formatters/json.js";
import { formatPretty } from "../formatters/pretty.js";
import { resolveRuleReference, validateRules } from "../rules/registry.js";
import { getVersion } from "../version.js";
import { initRule } from "./init-rule.js";
import { installSkill } from "./install-skill.js";

const program = new Command();

program
  .name("asciidoclint")
  .description("Lint AsciiDoc syntax, structure, dependencies, and policy")
  .version(getVersion());

program
  .command("init-rule")
  .description("scaffold a custom rule")
  .requiredOption("--pack <name>", "rule pack name")
  .requiredOption("--id <id>", "stable rule id")
  .requiredOption("--alias <alias>", "readable rule alias")
  .option("--directory <dir>", "rule directory", "lint-rules")
  .action((options: { pack: string; id: string; alias: string; directory: string }) => {
    const files = initRule(options);
    for (const file of files) {
      console.log(file);
    }
  });

program
  .command("install-skill")
  .description("install the bundled Codex skill")
  .option("--dest <directory>", "skills root directory")
  .option("--project", "install into .codex/skills in the current project")
  .option("--force", "replace an existing installed skill")
  .action((options: { dest?: string; project?: boolean; force?: boolean }) => {
    try {
      const result = installSkill(options);
      console.log(`Installed asciidoclint skill to ${result.destination}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    }
  });

program
  .argument("[files...]", "AsciiDoc files or glob patterns")
  .option("-f, --format <format>", "output format: pretty or json", "pretty")
  .option("-c, --config <file>", "configuration file")
  .option("--fix", "apply safe fixes")
  .option("--unsafe", "also apply unsafe fixes with --fix")
  .option("--output-diagnostics <file>", "write JSON diagnostics artifact for editor import")
  .option("--list-rules", "list configured built-in and custom rules")
  .option("--explain <rule>", "explain a configured rule by id or alias")
  .option("--validate-rules", "validate configured rule registry")
  .action(async (files: string[], options: { format: "pretty" | "json"; config?: string; fix?: boolean; unsafe?: boolean; outputDiagnostics?: string; listRules?: boolean; explain?: string; validateRules?: boolean }) => {
    const { rules } = await loadRules({ configFile: options.config });
    if (options.validateRules) {
      validateRules(rules);
      console.log("Rule registry is valid");
      return;
    }
    if (options.listRules) {
      console.log(JSON.stringify(rules.map(ruleMetadata), null, 2));
      return;
    }
    if (options.explain) {
      const rule = resolveRuleReference(rules, options.explain);
      if (!rule) {
        console.error(`Unknown rule: ${options.explain}`);
        process.exitCode = 2;
        return;
      }
      console.log(JSON.stringify(ruleMetadata(rule), null, 2));
      return;
    }
    const result = await lintFiles(files, {
      configFile: options.config,
      format: options.format,
      fix: options.fix,
      unsafeFixes: options.unsafe,
      outputDiagnosticsFile: options.outputDiagnostics,
    });
    console.log(options.format === "json" ? formatJson(result) : formatPretty(result));
    process.exitCode = result.findings.some((finding) => finding.severity === "error") ? 1 : 0;
  });

await program.parseAsync();
