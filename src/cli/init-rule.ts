import fs from "node:fs";
import path from "node:path";

export interface InitRuleOptions {
  pack: string;
  id: string;
  alias: string;
  directory?: string;
}

export function initRule(options: InitRuleOptions): string[] {
  const directory = path.resolve(options.directory ?? "lint-rules");
  const basename = `${options.id}-${options.alias}`;
  const rulePath = path.join(directory, `${basename}.ts`);
  const testPath = path.join(directory, `${basename}.test.ts`);
  const fixtureDirectory = path.join(directory, "fixtures", basename);
  const badFixture = path.join(fixtureDirectory, "bad.adoc");
  const goodFixture = path.join(fixtureDirectory, "good.adoc");

  fs.mkdirSync(fixtureDirectory, { recursive: true });
  writeNew(rulePath, ruleTemplate(options));
  writeNew(testPath, testTemplate(options));
  writeNew(badFixture, "This line has TODO work.\n");
  writeNew(goodFixture, "This line links to issue PROJ-123.\n");

  return [rulePath, testPath, badFixture, goodFixture];
}

function writeNew(file: string, content: string): void {
  if (fs.existsSync(file)) {
    throw new Error(`Refusing to overwrite existing file: ${file}`);
  }
  fs.writeFileSync(file, content);
}

function ruleTemplate(options: InitRuleOptions): string {
  return `import type { Rule } from "asciidoclint";

export default {
  id: "${options.id}",
  alias: "${options.alias}",
  description: "Describe what this rule checks",
  tags: ["${options.pack}"],
  docs: {
    summary: "Explain the rule in one sentence.",
    rationale: "Explain why the problematic structure should be avoided.",
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
} satisfies Rule;
`;
}

function testTemplate(options: InitRuleOptions): string {
  const basename = `${options.id}-${options.alias}`;
  return `import { describe, expect, it } from "vitest";
import rule from "./${basename}.js";

describe("${options.id}/${options.alias}", () => {
  it("has complete metadata", () => {
    expect(rule.id).toBe("${options.id}");
    expect(rule.alias).toBe("${options.alias}");
    expect(rule.docs?.badExamples?.length).toBeGreaterThan(0);
    expect(rule.docs?.goodExamples?.length).toBeGreaterThan(0);
  });
});
`;
}
