---
name: asciidoclint-rule-review
description: "Use when revisiting, designing, accepting, rejecting, or changing an asciidoclint built-in or custom rule. Applies an Asciidoctor-first review routine: check AsciiDoc/Asciidoctor mandates and recommendations, verify Asciidoctor behavior, compare with existing rules for overlap/conflict, decide built-in vs custom, severity, fixability, human/AI fix helper, examples, implementation, docs, and tests. Update this skill when the rule-review criteria are refined."
metadata:
  internal: true
---

# asciidoclint Rule Review

Use this workflow whenever reviewing an `AD###` built-in rule or an experimental/custom rule intended to inform built-in policy.

## Baseline

- Treat current Asciidoctor documentation and Asciidoctor.js behavior as the practical language baseline until the AsciiDoc Language Specification is ratified and precise for the case.
- If Asciidoctor.js can parse, diagnose, or expose the construct directly, use Asciidoctor.js as the parser authority. Do not duplicate that parser logic in rules or `src/parsers/tolerant.ts`. Specific `AD###` rules may wrap `AD000/asciidoctor-diagnostic` findings or Asciidoctor-derived normalized blocks for stable docs, severity, config, fixes, or examples.
- Use the tolerant parser only for recovery, dependency scanning, source maps, fix planning, and conservative checks Asciidoctor does not expose.

## Review Steps

1. Inspect current rule code, docs, tests, reports, and README references.
   - Check `src/rules/AD###.ts`.
   - Check `docs/rules/AD###.md`.
   - Check `docs/rules/rule-necessity.md`.
   - Search for rule ID and alias with `rg`.

2. Check AsciiDoc/Asciidoctor authority.
   - What is mandated?
   - What is recommended?
   - What is illegal?
   - What is optional, accepted, or only a style preference?
   - Prefer official docs under `docs.asciidoctor.org`; use exact source links in the final response when browsed.

3. Verify Asciidoctor.js behavior locally.
   - Render or parse minimal bad/good examples with the repo's installed `asciidoctor` package.
   - Capture whether Asciidoctor emits `ERROR`, `WARNING`, no diagnostic, or silently renders differently from source intent.
   - For includes, tables, sections, and blocks, inspect the Asciidoctor AST or rendered HTML/PDF-relevant behavior when useful.

4. Decide parser ownership for the construct.
   - First ask whether Asciidoctor.js exposes the needed syntax or structure fact through diagnostics, AST, converted output, source locations, or normalized spans. If yes, the rule must use that Asciidoctor-owned fact.
   - If the normalized model does not expose an Asciidoctor-owned fact yet, prefer extending the Asciidoctor adapter and normalized model over adding a source scanner.
   - If the rule must source-scan because Asciidoctor.js hides the failed intent after parsing, prove the scanner's grammar coverage from AsciiDoc/Asciidoctor documentation.
   - Source scanners must enumerate all supported syntax variants in docs and tests. Do not say "list", "table", "image", "block", or similar broad grammar terms unless the scanner covers every documented variant that matters to the rule.
   - If full variant coverage is not practical, narrow the rule name, message, docs, and tests to the exact supported subset, or move the rule out of built-ins.
   - For scanner helpers shared by multiple rules, add helper-level tests that pin the supported variants and documented exclusions.

5. Argue what asciidoclint wants.
   - Decide whether the rule is syntax/structure correctness, documented recommendation, publishability guidance, conversion cleanup, accessibility, dependency validation, or organization style.
   - Do not keep generic editor hygiene or house style as built-in unless it has broad AsciiDoc-specific value.

6. Check overlap and conflict.
   - Identify whether another built-in already covers the same behavior.
   - If Asciidoctor emits `AD000`, decide whether the specific rule should wrap it or be removed.
   - Check special document modes such as `article`, `book`, `manpage`, wrapper documents, includes, `leveloffset`, comments, protected blocks, tables, and source blocks.

7. Decide placement, severity, fixability, and fix helper.
   - Built-in `error`: Asciidoctor error, invalid/unsafe structure, missing local dependency, or rendered/AST output is not trustworthy.
   - Built-in `warning`: Asciidoctor-documented recommendation or broadly applicable quality issue where output is likely incomplete, inaccessible, confusing, or fragile.
   - Built-in `info`: asciidoclint recommendation for publishability/maintainability that Asciidoctor accepts and does not document as required.
   - Custom rule: organization/template/style/conformance preference or useful experimental example not appropriate for all AsciiDoc users.
   - Fixable `safe`: deterministic edit preserves author intent and should be valid across normal documents.
   - Fixable `unsafe`: edit is plausible but may choose between multiple valid author intents, change hierarchy, rewrite prose, or require project context.
   - Fixability `no`: requires author choice, missing asset/content creation, external validation, semantic naming, or broad restructuring.
   - If fixable, rule metadata must declare `docs.fixability`, findings must carry fix edits, docs must include fixability, and tests must prove fix application.
   - Every rule needs `docs.fixHelper` for humans and AI. It is the default
     helper for all findings from the rule.
   - A finding may set `fixHelper` only to provide more specific local guidance
     than `docs.fixHelper`, such as a computed marker, missing target, or include
     context. The lint API resolves `finding.fixHelper ?? rule.docs?.fixHelper`.
   - For safe/unsafe fixes, describe the exact edit pattern. For `no`, describe
     the decision the author must make and the acceptable repair options.

8. Update artifacts when the decision changes.
   - Rule implementation and metadata.
   - Rule docs with `Necessity`, `Rationale`, fixability, fix helper, bad example with what is wrong, good example with expected behavior, implementation notes, and exceptions.
   - `docs/rules/rule-necessity.md`, including severity and fixability.
   - README and reports when alias, scope, mapping, or severity changes.
   - Tests proving bad/good examples, edge cases, and no false positives for documented exceptions.
   - If examples are inspired by real user/project documents, desensitize them
     before committing docs or tests. Do not include target-specific product,
     project, person, company, organization, customer, internal path, bug ID,
     register/interface, or document names. Use neutral placeholders such as
     `DEVICE_STATUS`, `PORT[0-3]`, `chapter.adoc`, `diagram.png`, and
     `https://example.org`.
   - Real corpus scans are allowed as private analysis input only. Public repo
     fixtures, rule docs, reports, and snapshots must contain sanitized examples
     that preserve the syntax shape under test without exposing source content.
   - Before verification, scan touched docs and tests for unsanitized terms from
     the source corpus and replace them with generic equivalents.

9. Verify.
   - Run targeted tests for changed code/docs.
   - Run `npm run build` after TypeScript changes.
   - If comparison fixtures or generated reports changed, run the relevant comparison tests.

## Final Response Shape

Report the conclusion in this order:

- AsciiDoc/Asciidoctor docs: mandated/recommended/illegal/optional.
- Asciidoctor.js behavior: local evidence.
- Parser ownership: Asciidoctor-owned or source-scanned, with variant coverage
  evidence for any source scanner.
- asciidoclint decision: built-in/custom/remove, severity, and rationale.
- Fixability and fix helper: safe/unsafe/no, why, and how a human or AI should repair it.
- Overlap/conflict: related rules and how boundaries are handled.
- Changes made and tests run.

Keep the skill current: if the user refines the rule-review criteria during a rule revisit, update this `SKILL.md` before continuing.
