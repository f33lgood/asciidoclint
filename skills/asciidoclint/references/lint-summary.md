# Lint Summary Workflow

Run lint in JSON mode:

```bash
npx asciidoclint --format json <targets>
```

If the user wants deterministic safe fixes, run:

```bash
npx asciidoclint --fix --format json <targets>
```

Then rerun without `--fix` and summarize remaining findings.

Run unsafe fixes only when explicitly requested:

```bash
npx asciidoclint --fix --unsafe --format json <targets>
```

Unsafe fixes may alter rendered structure, link semantics, paths, or author
intent. Rerun lint after unsafe fixes.

For VS Code-compatible editor diagnostics import, write:

```bash
npx asciidoclint --format json \
  --output-diagnostics .asciidoclint/diagnostics.json \
  <targets>
```

Summarize results by:

- active vs waived findings;
- severity: `error`, `warning`, `info`;
- rule ID and alias;
- file and source line;
- fix availability: safe deterministic fix, unsafe deterministic fix, or no
  deterministic fix;
- highest-impact next action.

Keep the final summary concise. Include counts and representative findings, not
the full JSON payload unless the user asks for it.
