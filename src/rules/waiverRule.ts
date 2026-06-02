import type { Rule } from "../types.js";

export interface WaiverRuleDefinition {
  id: string;
  alias: string;
  description: string;
  summary: string;
  rationale: string;
  fixHelper: string;
  message: string;
  bad: string;
  good: string;
}

export const waiverRuleDefinitions = {
  ADW01: {
    id: "ADW01",
    alias: "unknown-waiver-directive",
    description: "Waiver directives should use a supported asciidoclint directive name",
    summary: "Waiver directive names should be known.",
    rationale: "Unknown waiver directives are ignored by the waiver parser, so the author may believe a finding is waived when no supported waiver was applied.",
    fixHelper: "Replace the directive name with disable-next-line, disable-block, or enable-block.",
    message: "Unknown asciidoclint waiver directive",
    bad: "// asciidoclint disable AD023",
    good: "// asciidoclint disable-next-line AD023 -- intentional placeholder\n== Reserved",
  },
  ADW02: {
    id: "ADW02",
    alias: "missing-waiver-rule-list",
    description: "Waiver directives should name at least one rule ID",
    summary: "Waiver directives should include a rule list.",
    rationale: "A waiver without a rule list has unclear intent and can be mistaken for a broad or global disable. Rule-ID scoped waivers keep suppression auditable.",
    fixHelper: "Add the exact rule ID or IDs that the waiver is intended to cover.",
    message: "Waiver directive must name at least one rule ID",
    bad: "// asciidoclint disable-next-line",
    good: "// asciidoclint disable-next-line AD023 -- intentional placeholder\n== Reserved",
  },
  ADW03: {
    id: "ADW03",
    alias: "malformed-waiver-rule-list",
    description: "Waiver rule lists should be comma-separated rule IDs",
    summary: "Waiver rule lists should use comma-separated rule IDs.",
    rationale: "A malformed rule list cannot be interpreted reliably, so the waiver parser ignores the malformed entries instead of guessing author intent.",
    fixHelper: "Rewrite the rule list as comma-separated rule IDs, for example AD023, AD014.",
    message: "Waiver rule list must be comma-separated rule IDs",
    bad: "// asciidoclint disable-next-line AD023 AD014",
    good: "// asciidoclint disable-next-line AD023, AD014 -- documented exception\n== Reserved",
  },
  ADW04: {
    id: "ADW04",
    alias: "unknown-waiver-rule-id",
    description: "Waiver rule lists should only reference defined rule IDs",
    summary: "Waiver rule IDs should be defined rules.",
    rationale: "Unknown rule IDs make waivers ineffective and can hide typos in waiver exceptions.",
    fixHelper: "Correct the rule ID or remove it from the waiver if no such rule exists.",
    message: "Unknown waiver rule ID",
    bad: "// asciidoclint disable-next-line AD999",
    good: "// asciidoclint disable-next-line AD023 -- intentional placeholder\n== Reserved",
  },
  ADW05: {
    id: "ADW05",
    alias: "unpaired-waiver-enable-block",
    description: "Waiver enable-block directives should have a preceding disable-block",
    summary: "Waiver enable-block directives should be paired with preceding disable-block directives.",
    rationale: "An unpaired enable-block does not close any waiver range and usually indicates a misplaced or deleted disable-block directive.",
    fixHelper: "Remove the unpaired enable-block or add the preceding disable-block before the intended waiver range.",
    message: "enable-block has no preceding disable-block",
    bad: "// asciidoclint enable-block AD023",
    good: "// asciidoclint disable-block AD023 -- intentional placeholder range\n== Reserved\n// asciidoclint enable-block AD023",
  },
  ADW06: {
    id: "ADW06",
    alias: "unpaired-waiver-disable-block",
    description: "Waiver disable-block directives should have a following enable-block",
    summary: "Waiver disable-block directives should be paired with following enable-block directives.",
    rationale: "An unpaired disable-block applies through the end of the physical file, which can waive more findings than the author intended.",
    fixHelper: "Add the following enable-block after the intended waiver range, or replace the block waiver with disable-next-line when only one line is intended.",
    message: "disable-block has no following enable-block",
    bad: "// asciidoclint disable-block AD023\n== Reserved",
    good: "// asciidoclint disable-block AD023 -- intentional placeholder range\n== Reserved\n// asciidoclint enable-block AD023",
  },
  ADW07: {
    id: "ADW07",
    alias: "mismatched-waiver-block-rule-list",
    description: "Waiver enable-block rule lists should match the active disable-block rule list",
    summary: "Waiver block delimiters should use matching rule lists.",
    rationale: "Mismatched block rule lists make the waiver range ambiguous and can leave authors uncertain which rules were waived.",
    fixHelper: "Make the enable-block rule list match the corresponding disable-block rule list exactly.",
    message: "enable-block rule list does not match the active disable-block",
    bad: "// asciidoclint disable-block AD023\n== Reserved\n// asciidoclint enable-block AD034",
    good: "// asciidoclint disable-block AD023 -- intentional placeholder range\n== Reserved\n// asciidoclint enable-block AD023",
  },
  ADW08: {
    id: "ADW08",
    alias: "waiver-targets-waiver-rule",
    description: "Source waivers should not target ADW waiver diagnostics",
    summary: "Waiver diagnostics should not be waived.",
    rationale: "Waiver syntax diagnostics protect the integrity of the waiver system. Allowing source waivers to suppress them would make malformed or overbroad waivers harder to audit.",
    fixHelper: "Remove ADW## IDs from the waiver rule list and fix the waiver directive syntax instead.",
    message: "Waiver diagnostics cannot be waived",
    bad: "// asciidoclint disable-next-line ADW01 -- invalid waiver target",
    good: "// asciidoclint disable-next-line AD023 -- intentional placeholder\n== Reserved",
  },
} satisfies Record<string, WaiverRuleDefinition>;

export type WaiverRuleId = keyof typeof waiverRuleDefinitions;

export function waiverRule(params: WaiverRuleDefinition): Rule {
  return {
    id: params.id,
    alias: params.alias,
    description: params.description,
    tags: ["waiver"],
    parser: "text",
    docs: {
      summary: params.summary,
      rationale: params.rationale,
      fixability: "no",
      fixHelper: params.fixHelper,
      badExamples: [{ code: params.bad }],
      goodExamples: [{ code: params.good }],
    },
    function: () => undefined,
  };
}
