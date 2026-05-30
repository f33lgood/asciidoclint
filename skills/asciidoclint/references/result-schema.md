# asciidoclint Result Schema

Use `--format json` for machine-readable output.

Top-level fields:

- `files`: absolute file paths linted by the engine.
- `findings`: ordered lint findings.

Finding fields:

- `ruleId`: stable rule ID such as `AD001`.
- `alias`: optional readable rule alias.
- `severity`: `error`, `warning`, or `info`.
- `message`: concise diagnostic message.
- `detail`: optional additional detail.
- `context`: optional source context.
- `fixHelper`: optional repair instruction for humans or AI agents.
- `range.start.file`, `range.start.line`, `range.start.column`: source
  location.
- `fix.applicability`: `safe` or `unsafe` when an automatic edit exists.
- `fix.edits`: text edits emitted by deterministic rules.
