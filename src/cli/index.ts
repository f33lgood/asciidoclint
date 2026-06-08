#!/usr/bin/env node
import { Command } from "commander";
import { lintFiles } from "../api/lint.js";
import { loadConfigDetails, loadRules, ruleMetadata } from "../api/rules.js";
import { formatJson } from "../formatters/json.js";
import { formatPretty } from "../formatters/pretty.js";
import { resolveRuleReference, validateRules } from "../rules/registry.js";
import { getVersion } from "../version.js";
import { formatRuleExplanation } from "./explain.js";
import { initRule } from "./init-rule.js";
import { installSkill, uninstallSkill } from "./install-skill.js";

const program = new Command();

program
  .name("asciidoclint")
  .description("Lint AsciiDoc syntax, structure, dependencies, and policy")
  .version(getVersion());

program
  .command("init-rule")
  .description("scaffold a project-local custom rule")
  .option("--tag <tag>", "rule tag used for grouping, such as organization or product-docs")
  .option("--pack <name>", "deprecated alias for --tag")
  .requiredOption("--id <id>", "stable rule id")
  .requiredOption("--alias <alias>", "readable rule alias")
  .option("--directory <dir>", "rule directory", "lint-rules")
  .action((options: { tag?: string; pack?: string; id: string; alias: string; directory: string }) => {
    try {
      const files = initRule(options);
      for (const file of files) {
        console.log(file);
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    }
  });

program
  .command("install-skill")
  .description("install the bundled AI-agent skill")
  .option("--dest <directory>", "skills root directory")
  .option("--agent <agent>", "deprecated; fails with guidance instead of selecting a skill root")
  .option("--project", "install into project .agents and .claude skill roots")
  .option("--force", "replace an existing installed skill")
  .action((options: { dest?: string; project?: boolean; agent?: "codex" | "cursor" | "claude-code" | "openclaw"; force?: boolean }) => {
    try {
      const result = installSkill(options);
      console.log(`Installed asciidoclint skill to ${result.destinations.join(", ")}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    }
  });

program
  .command("uninstall-skill")
  .description("uninstall the AI-agent skill")
  .option("--dest <directory>", "skills root directory")
  .option("--agent <agent>", "deprecated; fails with guidance instead of selecting a skill root")
  .option("--project", "uninstall from project .agents and .claude skill roots")
  .action((options: { dest?: string; project?: boolean; agent?: "codex" | "cursor" | "claude-code" | "openclaw" }) => {
    try {
      const result = uninstallSkill(options);
      console.log(
        result.removed
          ? `Uninstalled asciidoclint skill from ${result.removedDestinations.join(", ")}`
          : `No asciidoclint skill installed at ${result.destinations.join(", ")}`,
      );
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 2;
    }
  });

program
  .argument("[files...]", "AsciiDoc files or glob patterns")
  .option("-f, --format <format>", "output format: pretty or json", "pretty")
  .option("-c, --config <file>", "configuration file")
  .option("--no-global-config", "do not load ~/.asciidoclint/config.yaml")
  .option("--fix", "apply safe fixes")
  .option("--unsafe", "also apply unsafe fixes with --fix")
  .option("--custom-rule <package>", "load an extra custom rule package folder, package name, or module", collectValues, [])
  .option("--output-diagnostics <file>", "write JSON diagnostics artifact for editor import")
  .option("--print-config", "print the merged configuration and exit")
  .option("--list-rules", "list configured built-in and custom rules")
  .option("--explain <rule>", "explain a configured rule by id or alias")
  .option("--validate-rules", "validate configured rule registry")
  .action(async (files: string[], options: { format: "pretty" | "json"; config?: string; globalConfig?: boolean; fix?: boolean; unsafe?: boolean; customRule?: string[]; outputDiagnostics?: string; printConfig?: boolean; listRules?: boolean; explain?: string; validateRules?: boolean }) => {
    const noGlobalConfig = options.globalConfig === false;
    if (options.printConfig) {
      const { config, sources } = loadConfigDetails({ configFile: options.config, noGlobalConfig });
      console.log(JSON.stringify({
        sources,
        config: {
          ...config,
          customRules: [...(config.customRules ?? []), ...(options.customRule ?? [])],
        },
      }, null, 2));
      return;
    }
    const { rules } = await loadRules({ configFile: options.config, customRules: options.customRule, noGlobalConfig });
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
      console.log(options.format === "json" ? JSON.stringify(ruleMetadata(rule), null, 2) : formatRuleExplanation(rule));
      return;
    }
    const result = await lintFiles(files, {
      configFile: options.config,
      customRules: options.customRule,
      noGlobalConfig,
      format: options.format,
      fix: options.fix,
      unsafeFixes: options.unsafe,
      outputDiagnosticsFile: options.outputDiagnostics,
    });
    console.log(options.format === "json" ? formatJson(result) : formatPretty(result));
    process.exitCode = result.findings.some((finding) => !finding.waived && finding.severity === "error") ? 1 : 0;
  });

await program.parseAsync();

function collectValues(value: string, previous: string[]): string[] {
  return [...previous, value];
}
