import type { Rule } from "../types.js";

export function validateRules(rules: Rule[]): void {
  const ids = new Set<string>();
  const aliases = new Set<string>();
  for (const rule of rules) {
    if (!rule.id) {
      throw new Error("Rule is missing required id");
    }
    if (ids.has(rule.id)) {
      throw new Error(`Duplicate rule id: ${rule.id}`);
    }
    if (aliases.has(rule.id)) {
      throw new Error(`Rule id collides with an alias: ${rule.id}`);
    }
    ids.add(rule.id);
    if (rule.alias) {
      if (aliases.has(rule.alias)) {
        throw new Error(`Duplicate rule alias: ${rule.alias}`);
      }
      if (ids.has(rule.alias)) {
        throw new Error(`Rule alias collides with an id: ${rule.alias}`);
      }
      aliases.add(rule.alias);
    }
    if (!rule.description) {
      throw new Error(`Rule ${rule.id} is missing description`);
    }
    if (!rule.docs?.summary) {
      throw new Error(`Rule ${rule.id} is missing docs.summary`);
    }
  }
}

export function resolveRuleReference(rules: Rule[], reference: string): Rule | undefined {
  return rules.find((rule) => rule.id === reference || rule.alias === reference);
}

