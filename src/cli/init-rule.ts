import fs from "node:fs";
import path from "node:path";

export interface InitRuleOptions {
  tag?: string;
  pack?: string;
  id: string;
  alias: string;
  directory?: string;
}

export function initRule(options: InitRuleOptions): string[] {
  const tag = options.tag ?? options.pack;
  if (!tag) {
    throw new Error("A custom rule tag is required; pass --tag <tag>.");
  }
  const normalized = { ...options, tag };
  const directory = path.resolve(options.directory ?? "lint-rules");
  const basename = `${options.id}-${options.alias}`;
  const sourceDirectory = path.join(directory, "src");
  const docsDirectory = path.join(directory, "docs");
  const rulePath = path.join(sourceDirectory, `${basename}.js`);
  const indexPath = path.join(sourceDirectory, "index.js");
  const docPath = path.join(docsDirectory, `${basename}.md`);
  const testPath = path.join(directory, `${basename}.test.js`);
  const fixtureDirectory = path.join(directory, "fixtures", basename);
  const badFixture = path.join(fixtureDirectory, "bad.adoc");
  const goodFixture = path.join(fixtureDirectory, "good.adoc");

  fs.mkdirSync(sourceDirectory, { recursive: true });
  fs.mkdirSync(docsDirectory, { recursive: true });
  fs.mkdirSync(fixtureDirectory, { recursive: true });
  writeNew(rulePath, ruleTemplate(normalized));
  updateIndex(indexPath, normalized);
  writeNew(docPath, docsTemplate(normalized));
  writeNew(testPath, testTemplate(normalized));
  writeNew(badFixture, "This line has TODO work.\n");
  writeNew(goodFixture, "This line links to issue PROJ-123.\n");

  return [rulePath, indexPath, docPath, testPath, badFixture, goodFixture];
}

function writeNew(file: string, content: string): void {
  if (fs.existsSync(file)) {
    throw new Error(`Refusing to overwrite existing file: ${file}`);
  }
  fs.writeFileSync(file, content);
}

function updateIndex(file: string, options: InitRuleOptions & { tag: string }): void {
  const basename = `${options.id}-${options.alias}`;
  const symbol = `${options.id}_${options.alias.replace(/[^A-Za-z0-9]+/g, "_")}`;
  const importLine = `import ${symbol} from "./${basename}.js";`;
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (existing.includes(importLine)) {
    return;
  }

  const imports = [...existing.matchAll(/^import .+;$/gm)].map((match) => match[0]);
  const ruleSymbols = [...existing.matchAll(/^import ([A-Za-z0-9_]+) from /gm)].map((match) => match[1]).filter(Boolean);
  const nextImports = [...imports, importLine].sort();
  const nextRuleSymbols = [...ruleSymbols, symbol].sort();
  const content = `${nextImports.join("\n")}

export const rules = [${nextRuleSymbols.join(", ")}];
export default rules;
`;
  fs.writeFileSync(file, content);
}

function ruleTemplate(options: InitRuleOptions & { tag: string }): string {
  return `/** @type {import("asciidoclint").Rule} */
const rule = {
  id: "${options.id}",
  alias: "${options.alias}",
  description: "Describe what this rule checks",
  tags: ["${options.tag}"],
  docs: {
    summary: "Explain the rule in one sentence.",
    rationale: "Explain why the problematic structure should be avoided.",
    fixability: "no",
    fixHelper: "Explain how a human or AI agent should repair this finding.",
    badExamples: [{ code: "Problematic AsciiDoc example" }],
    goodExamples: [{ code: "Expected AsciiDoc example" }],
  },
  parser: "text",
  function: (params, onError) => {
    params.lines.forEach((line, index) => {
      const column = line.indexOf("TODO");
      if (column !== -1) {
        onError({
          severity: "warning",
          message: "Replace this placeholder rule logic",
          range: {
            start: {
              file: params.file,
              line: index + 1,
              column: column + 1,
            },
          },
        });
      }
    });
  },
};

export default rule;
`;
}

function docsTemplate(options: InitRuleOptions & { tag: string }): string {
  return `# ${options.id} - ${options.alias}

Tags: ${options.tag}
Severity: warning
Fixability: no

Description: Describe what this rule checks.

Necessity: Explain the organization, project, or template policy that makes this rule useful.

Rationale: Explain why this rule belongs in this custom rule pack instead of the built-in rule set.

Fix helper: Explain how a human or AI agent should repair this finding.

Bad:

What's wrong: Explain the exact defect in the bad example.

\`\`\`asciidoc
This line has TODO work.
\`\`\`

Good:

Expected: Explain what the good example does correctly.

\`\`\`asciidoc
This line links to issue PROJ-123.
\`\`\`

Implementation note: Mention parser surface, configuration, fix behavior, and known limits.
`;
}

function testTemplate(options: InitRuleOptions & { tag: string }): string {
  const basename = `${options.id}-${options.alias}`;
  return `import { describe, expect, it } from "vitest";
import rule from "./src/${basename}.js";

describe("${options.id}/${options.alias}", () => {
  it("has complete metadata", () => {
    expect(rule.id).toBe("${options.id}");
    expect(rule.alias).toBe("${options.alias}");
    expect(rule.docs?.fixHelper).toBeTruthy();
    expect(rule.docs?.badExamples?.length).toBeGreaterThan(0);
    expect(rule.docs?.goodExamples?.length).toBeGreaterThan(0);
  });
});
`;
}
