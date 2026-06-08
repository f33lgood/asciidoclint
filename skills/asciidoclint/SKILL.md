---
name: asciidoclint
description: Use when linting AsciiDoc with asciidoclint, summarizing findings, applying deterministic or AI-assisted fixes, adding source waivers, creating or reviewing custom asciidoclint rules, or preparing GitHub issue feedback for asciidoclint.
---

# asciidoclint

Use this skill for end-user `asciidoclint` workflows. Prefer the explicit
project-pinned `asciidoclint` install when present; otherwise use the user's
global `asciidoclint` on `PATH`.

## Tool Resolution

Use this order:

1. nearest project ancestor's `.asciidoclint/node_modules/.bin/asciidoclint`
2. `asciidoclint` on `PATH`
3. `npx asciidoclint`

After resolving the executable, refer to it as `<asciidoclint>` in workflow
commands. Do not search standard workspace `node_modules/.bin/asciidoclint`
from this skill.

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

- Preserve the user's target documents when linting, fixing, or adding waivers.
  Do not replace real document terms with placeholders inside the user's own
  source files unless the user asks for anonymization.
- Sanitize only source-derived material that will leave the local document
  workflow or become reusable/committed content. This includes final summaries,
  GitHub issue drafts, prompts to other AI agents, docs, fixtures, tests,
  snapshots, generated examples, and copied JSON output.
- In those shareable or committed artifacts, do not include real customer names,
  employer or organization names, people, usernames, emails, internal paths,
  private URLs, bug IDs, project names, product codenames,
  register/interface names, device names, confidential excerpts, or proprietary
  examples. Replace them with neutral placeholders while preserving the syntax
  shape needed for the lint issue, test, or rule behavior.
- Before finalizing skill-authored reusable or committed artifacts, scan changed
  text for likely private residue such as personal paths, company domains,
  internal hostnames, user names, project/product codenames, bug IDs, and copied
  document terminology. Remove or generalize anything that is not required to
  reproduce generic behavior.
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
