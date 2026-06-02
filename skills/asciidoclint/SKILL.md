---
name: asciidoclint
description: Use when linting AsciiDoc with asciidoclint, summarizing findings, applying deterministic or AI-assisted fixes, adding source waivers, creating or reviewing custom asciidoclint rules, or preparing GitHub issue feedback for asciidoclint.
---

# asciidoclint

Use this skill for end-user `asciidoclint` workflows. Prefer the workspace
`asciidoclint` install when present so project configuration, custom rules, and
CI behavior match the user's project.

## Tool Resolution

Use this order:

1. `./node_modules/.bin/asciidoclint`
2. `npx asciidoclint`
3. `npx -y asciidoclint@latest`

Run from the repository or document workspace root unless the user names a
specific directory.

Use `--format json` for machine-readable results whenever findings need to be
summarized, repaired, waived, or reported.

## Workflow Routing

Load only the reference needed for the user's request:

- Lint and summary: `references/lint-summary.md`.
- Agentic repair of findings without deterministic fixes:
  `references/agentic-fix.md`.
- Source waiver authoring: `references/waivers.md`.
- Custom rule creation: `references/rule-create.md`.
- Rule review and policy decisions: `references/rule-review.md`.
- GitHub feedback message preparation: `references/feedback.md`.
- JSON fields and report shape: `references/result-schema.md`.

## Safety Defaults

- Prefer fixing a document over waiving a finding.
- Run deterministic safe fixes with `--fix` when the user asks to fix.
- Run unsafe fixes with `--fix --unsafe` only when the user explicitly asks for
  unsafe fixes.
- For AI-assisted edits, use each finding's `fixHelper` as the primary repair
  instruction and keep edits scoped to the reported issue.
- Rerun `asciidoclint` after fixes, waivers, or rule changes and summarize what
  changed.

If no targets are provided, use the current workspace's AsciiDoc files or the
tool default.
