# Source Waiver Workflow

Use waivers only when fixing the document is not the right change, such as
generated content, imported legacy text, or a documented publication exception.

First run lint in JSON mode and identify the exact finding to waive. Place the
waiver in the same physical file as the finding's `range.start.file`.

Prefer the narrowest scope. For a single source line:

```adoc
// asciidoclint disable-next-line AD023 -- intentional placeholder section for generated output
== Reserved
```

For a short range:

```adoc
// asciidoclint disable-block AD023 -- generated legacy content is kept verbatim
== Reserved

// asciidoclint enable-block AD023
```

Rules for skill-authored waivers:

- name rule IDs only, such as `AD023`; do not use aliases or tags;
- include a reason after `--`;
- use `disable-next-line` for one source line;
- use `disable-block` and `enable-block` only for short ranges;
- do not target `ADW##` waiver diagnostics;
- do not use Markdown-style HTML comments or trailing paragraph comments;
- rerun lint and confirm the intended finding is marked `waived`;
- confirm no new `ADW##` diagnostics were introduced.

Valid directive syntax:

```text
// asciidoclint disable-next-line RULE[, RULE...] [-- reason]
// asciidoclint disable-block RULE[, RULE...] [-- reason]
// asciidoclint enable-block RULE[, RULE...]
```
