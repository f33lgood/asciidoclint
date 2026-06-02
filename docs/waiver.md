# Waiver Architecture

`asciidoclint` supports source waivers for intentional findings that should
remain visible to tooling but not count as active lint failures.

Prefer fixing the document over waiving a finding. Use waivers only when the
source is intentionally kept as-is, such as generated content, imported legacy
text, or a documented publication exception.

## Syntax

Waivers use native AsciiDoc line comments:

```adoc
// asciidoclint disable-next-line AD023, AD014 -- optional reason
problematic line
```

```adoc
// asciidoclint disable-block AD023, AD014 -- optional reason
problematic block
// asciidoclint enable-block AD023, AD014
```

Supported directives:

```text
// asciidoclint disable-next-line RULE[, RULE...] [-- reason]
// asciidoclint disable-block RULE[, RULE...] [-- reason]
// asciidoclint enable-block RULE[, RULE...]
```

Rules:

- `disable-next-line` applies to the next physical source line.
- `disable-block` applies from the following line until the matching
  `enable-block`.
- Rule lists are required.
- Rule lists use comma-separated rule IDs, such as `AD023, AD014`.
- Aliases and tags are not supported in source waivers.
- Waiver diagnostics use `ADW##` rule IDs and cannot be waived.
- Reasons are optional, but skill-authored waivers should include a reason after
  `--`.
- Directive keywords are lowercase.

## Non-Syntax

Do not use Markdown-style HTML comments:

```adoc
<!-- asciidoclint disable-block AD023 -->
```

In normal AsciiDoc, HTML comment syntax is source text, not an AsciiDoc
comment, and can render visibly unless it is placed in a passthrough context.

Do not use trailing paragraph text:

```adoc
problematic line // asciidoclint disable-next-line AD023
```

That is valid AsciiDoc content, not a comment, and can render.

## Scope

Waivers are physical-file scoped. A waiver applies only to findings whose
`range.start.file` is the same file as the waiver directive.

This can waive a finding reported on the `include::` directive line:

```adoc
// asciidoclint disable-block AD024
include::chapter.adoc[]
// asciidoclint enable-block AD024
```

It does not waive findings inside `chapter.adoc`. If a finding starts in
`chapter.adoc`, place the waiver in `chapter.adoc`.

## Reporting

Waived findings remain in structured output and are marked as waived:

```json
{
  "ruleId": "AD023",
  "severity": "info",
  "message": "Section has no content.",
  "waived": true,
  "waiver": {
    "file": "chapter.adoc",
    "line": 12,
    "column": 1,
    "directive": "disable-next-line",
    "rules": ["AD023"],
    "reason": "intentional placeholder"
  }
}
```

For unwaived findings, omit `waived` and `waiver`. Do not emit
`"waived": false`.

The `waiver` object points to the waiver directive that covered the finding:

| Field | Required | Purpose |
|---|---:|---|
| `file` | yes | Waiver directive source file; enables audit links and editor related locations. |
| `line` | yes | Waiver directive source line. |
| `column` | yes | Waiver directive source column; use `1` when only line precision is available. |
| `directive` | yes | Directive kind, such as `disable-next-line` or `disable-block`. |
| `rules` | yes | Exact rule IDs named by the waiver directive. Useful for auditing multi-rule waivers. |
| `reason` | no | Optional text after `--`; recommended for skill-authored waivers. |

Human-readable output may hide waived findings by default, but the run summary
should still report how many findings were waived. JSON output should preserve
waived findings with waiver metadata for audit workflows.

Editor integrations should distinguish waived findings from active findings. In
VS Code-compatible editors, waived findings should either be hidden by default
or, when a show-waived setting is enabled, published as non-blocking diagnostics
with a visible `[WAIVED]` message prefix, `DiagnosticTag.Unnecessary`, waiver
location in `relatedInformation`, and waiver metadata preserved in the imported
JSON. Active findings should keep their normal severity and message.

VS Code `Diagnostic` does not have a native `waiver` field, so the extension
must project waiver metadata into compatible fields:

| VS Code field | Waived finding projection |
|---|---|
| `message` | Prefix with `[WAIVED]` when shown. |
| `severity` | Publish as informational so waived findings are visibly non-blocking. |
| `tags` | Include `DiagnosticTag.Unnecessary`. |
| `relatedInformation` | Point to `waiver.file`, `waiver.line`, and `waiver.column`. |
| `source` | Keep `asciidoclint`. |
| `code` | Keep the original finding rule ID, such as `AD023`. |

Waiver syntax problems are reported as `ADW##` diagnostics and are not waived by
the malformed directive that caused them. Source waivers cannot target `ADW##`
waiver diagnostics.

Each `ADW##` diagnostic is a built-in rule ID for documentation and tooling
purposes. It must have:

- a metadata rule file under `src/rules/ADW##.ts`;
- a per-rule documentation page under `docs/rules/ADW##.md`;
- an entry in `docs/rules/rule-necessity.md`;
- bad and good examples covered by the built-in rule example tests;
- a registry test that keeps the ADW namespace visible in the built-in rule
  contract.

The waiver parser emits ADW findings because matching malformed waiver syntax is
part of waiver parsing. The ADW rule functions may therefore be metadata-only
no-ops, but the IDs still follow the same rule contract as other built-ins.
ADW diagnostics are always on: rule configuration can document and display
their metadata, but it must not disable ADW findings or change their severity.
Source waivers also cannot target ADW diagnostics.

| ID | Rule | Condition |
|---|---|---|
| `ADW01` | `unknown-waiver-directive` | Unknown directive name |
| `ADW02` | `missing-waiver-rule-list` | Missing rule list |
| `ADW03` | `malformed-waiver-rule-list` | Malformed rule list |
| `ADW04` | `unknown-waiver-rule-id` | Unknown rule ID |
| `ADW05` | `unpaired-waiver-enable-block` | `enable-block` has no preceding `disable-block` |
| `ADW06` | `unpaired-waiver-disable-block` | `disable-block` has no following `enable-block` |
| `ADW07` | `mismatched-waiver-block-rule-list` | Mismatched block rule set |
| `ADW08` | `waiver-targets-waiver-rule` | Waiver rule list includes an `ADW##` ID |

An unpaired `enable-block` has no active preceding `disable-block` in the same
physical file. An unpaired `disable-block` reaches EOF without a following
`enable-block`; it applies through EOF and still reports `ADW06`.

This is invalid because waiver diagnostics cannot be waived:

```adoc
// asciidoclint disable-next-line ADW01 -- invalid: waiver diagnostics cannot be waived
```

It reports `ADW08`.

## Skill Support

The `asciidoclint` skill should help authors add waivers when fixing the
document is not the right change. Skill-authored waivers should:

- use the narrowest scope;
- use `disable-next-line` for one source line;
- use `disable-block` / `enable-block` only for short ranges;
- name only rule IDs;
- include a reason after `--`;
- place the waiver in the same physical file as the finding;
- never target `ADW##` waiver diagnostics.

Example:

```adoc
// asciidoclint disable-next-line AD023 -- intentional placeholder section for generated output
== Reserved
```
