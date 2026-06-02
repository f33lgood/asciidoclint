# ADW06 - unpaired-waiver-disable-block

Tags: waiver
Severity: warning
Fixability: no.
Fix helper: Add the following enable-block after the intended waiver range, or replace the block waiver with disable-next-line when only one line is intended.

Description: Waiver disable-block directives should have a following enable-block.

Necessity: An unpaired `disable-block` applies through the end of the physical file and can waive more findings than intended.

Rationale: Reporting the unpaired block keeps waiver ranges auditable while preserving the documented behavior that the block applies through EOF.

Bad:

What's wrong: The `disable-block` has no following `enable-block`.

```adoc
// asciidoclint disable-block AD023
== Reserved
```

Good:

Expected: The block waiver has paired start and end directives.

```adoc
// asciidoclint disable-block AD023 -- intentional placeholder range
== Reserved
// asciidoclint enable-block AD023
```

Implementation note: ADW06 is emitted by the waiver parser at EOF for each still-active `disable-block`. ADW diagnostics are always on and are not disabled by rule configuration.
