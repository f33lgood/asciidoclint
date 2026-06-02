import type { Rule, RuleExample } from "../types.js";

export function formatRuleExplanation(rule: Rule): string {
  const rows = [
    `${rule.id}${rule.alias ? ` ${rule.alias}` : ""}`,
    "",
    rule.description,
    "",
    `Parser: ${rule.parser}`,
    `Tags: ${rule.tags.length > 0 ? rule.tags.join(", ") : "none"}`,
  ];

  if (rule.docs?.fixability) {
    rows.push(`Fixability: ${rule.docs.fixability}`);
  }

  if (rule.docs?.summary) {
    rows.push("", "Summary:", rule.docs.summary);
  }

  if (rule.docs?.rationale) {
    rows.push("", "Why it matters:", rule.docs.rationale);
  }

  if (rule.docs?.fixHelper) {
    rows.push("", "How to fix:", rule.docs.fixHelper);
  }

  appendExamples(rows, "Bad", rule.docs?.badExamples);
  appendExamples(rows, "Good", rule.docs?.goodExamples);

  if (rule.docs?.url) {
    rows.push("", "More:", String(rule.docs.url));
  } else if (/^ADW?\d+$/i.test(rule.id)) {
    rows.push("", "More:", `docs/rules/${rule.id}.md`);
  }

  return `${rows.join("\n")}\n`;
}

function appendExamples(rows: string[], label: string, examples: RuleExample[] | undefined): void {
  if (!examples || examples.length === 0) {
    return;
  }

  rows.push("", `${label}:`);
  for (const example of examples) {
    if (example.title) {
      rows.push(example.title);
    }
    rows.push(example.code);
  }
}
