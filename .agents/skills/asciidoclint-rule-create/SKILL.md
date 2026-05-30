---
name: asciidoclint-rule-create
description: "Use when creating a new asciidoclint built-in rule or custom rule fixture, including rule file scaffolding, metadata, docs, examples, tests, severity, parser choice, fixability, and validation. For revisiting whether an existing rule should exist or change policy, use asciidoclint-rule-review."
metadata:
  internal: true
---

# asciidoclint Rule Create

Use this workflow when adding a new `asciidoclint` built-in rule or a
publishable custom rule fixture. If the task is to accept, reject, redesign, or
reclassify a rule, use `asciidoclint-rule-review` first.

## Rule Shape

- Use one rule per file.
- Built-ins live in `src/rules/AD###.ts`.
- Custom example rules live in
  `test/fixtures/custom-rules/src/ORG###-alias.ts`.
- Export one plain rule object with `id`, one `alias`, `description`, `tags`,
  `parser`, `docs.summary`, `docs.rationale`, `docs.fixability`,
  `docs.fixHelper`, and the rule function.
- Keep built-in IDs in the `AD###` namespace. Use a team-owned three-letter
  prefix such as `ORG###` for custom rules.
- Include at least one bad example and one good example in rule docs and tests.

## Parser Choice

- Use `text` for line-oriented checks where the source spelling matters.
- Use `document` for normalized section, block, heading, attribute, and
  structure checks.
- Use `dependency` for local include, image, xref, or target-resolution checks.
- Use `project` only when the rule truly needs cross-file context.
- Prefer Asciidoctor-owned parser facts over source scanning when available.
  Extend the normalized model instead of duplicating parser logic where practical.

## Severity and Fixability

- `error`: broken rendering, missing local dependency, invalid structure, or
  output that cannot be trusted.
- `warning`: likely wrong output, accessibility issue, fragile structure, or
  Asciidoctor-documented recommendation.
- `info`: maintainability, publishability, or organization policy that
  Asciidoctor accepts.
- `safe` fix: deterministic edit that preserves author intent.
- `unsafe` fix: plausible edit that may choose between valid author intents or
  require project context.
- `no` fix: author judgment, missing content/assets, semantic naming, or broad
  restructuring is required.
- If a rule is fixable, findings must carry fix edits and tests must prove fix
  application.
- `docs.fixHelper` is required for every rule. Per-finding `fixHelper` should
  only add local computed guidance.

## Documentation Contract

Every built-in and publishable custom rule needs a per-rule document with this
shape:

````markdown
# ORG001 - no-todo

Tags: organization, content
Severity: info
Fixability: no

Description: TODO markers should not be committed.

Necessity: Explain why the rule exists. For built-ins, tie it to rendered
AsciiDoc output, dependency integrity, navigation, accessibility, or baseline
technical-document quality. For custom rules, tie it to organization policy.

Rationale: Explain why the rule belongs in the built-in set or remains a custom
rule.

Fix helper: Explain the action a human or AI should take to resolve the finding.

Bad:

What's wrong: Explain the exact defect in the bad example.

```asciidoc
TODO: write this section.
```

Good:

Expected: Explain what the good example does correctly.

```asciidoc
See issue PROJ-123 for the remaining work.
```

Implementation note: Mention parser surface, important fields or patterns,
configuration, fix behavior, and known limits.
````

For built-ins, update `docs/rules/rule-necessity.md` with severity and
fixability.

## Tests and Examples

- Test bad and good examples from docs.
- Test important edge cases and documented exceptions.
- Test that protected contexts such as comments, source blocks, tables, or
  included files behave as intended when relevant.
- For source scanners, tests must enumerate the supported syntax variants and
  documented exclusions.
- Sanitize examples inspired by real documents. Do not commit target-specific
  product, project, person, company, organization, customer, internal path, bug
  ID, register/interface, or document names. Use placeholders such as
  `DEVICE_STATUS`, `PORT[0-3]`, `chapter.adoc`, `diagram.png`, and
  `https://example.org`.

## Validation Loop

After adding or changing rules:

```bash
npm run check
```

Run targeted tests first when available. Run `npm run build` after TypeScript
changes if `npm run check` is too broad for the current turn.
