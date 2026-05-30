---
name: asciidoclint
description: Use when linting, summarizing, or fixing AsciiDoc files with asciidoclint, including safe fixes, explicit unsafe fixes, diagnostics artifacts, and AI-assisted repairs based on asciidoclint findings.
---

# asciidoclint

Use this skill for AsciiDoc linting and repair workflows. Prefer the workspace
`asciidoclint` install when present so project configuration and custom rules
match CI.

## Tool Resolution

Use this order:

1. `./node_modules/.bin/asciidoclint`
2. `npx asciidoclint`
3. `npx -y asciidoclint@latest`

Run from the repository or document workspace root unless the user names a
specific directory.

## Check

For lint-only requests, run:

```bash
npx asciidoclint --format json <targets>
```

If no targets are provided, use the current workspace's AsciiDoc files or the
tool default. Summarize findings by severity, rule, file, and fixability. Report
safe and unsafe fix availability separately.

## Safe Fixes

For safe-fix requests, run:

```bash
npx asciidoclint --fix --format json <targets>
```

Then rerun without `--fix` and summarize remaining findings. Safe fixes are
deterministic edits emitted by rules.

## Unsafe Fixes

Only run unsafe fixes when the user explicitly asks for unsafe fixes:

```bash
npx asciidoclint --fix --unsafe --format json <targets>
```

Then rerun lint and summarize remaining findings. Unsafe fixes may alter
rendered structure, link semantics, or author intent.

## Editor Diagnostics Artifact

When the user wants CLI results visible in VS Code or Cursor, write the
diagnostics artifact:

```bash
npx asciidoclint --format json \
  --output-diagnostics .asciidoclint/diagnostics.json \
  <targets>
```

The asciidoclint extension can import this artifact into editor diagnostics.

## AI-Assisted Repairs

When the user asks for intelligent, AI, or LLM repair:

1. Run lint with JSON output.
2. Group findings by source file.
3. Read only affected ranges plus nearby context.
4. Use each finding's `ruleId`, `alias`, `message`, `detail`, `context`, and
   `fixHelper` as the repair instruction.
5. Apply focused edits.
6. Rerun asciidoclint.
7. Report fixed and remaining findings.

Do not invent broad prose/style rewrites unless the finding requires them. Keep
repairs scoped to the reported AsciiDoc issue.
