# ADW05 - unpaired-waiver-enable-block

Tags: waiver
Severity: warning
Fixability: no.
Fix helper: Remove the unpaired enable-block or add the preceding disable-block before the intended waiver range.

Description: Waiver enable-block directives should have a preceding disable-block.

Necessity: An unpaired `enable-block` closes no waiver range and usually indicates a misplaced or deleted preceding `disable-block`.

Rationale: Block waivers should have explicit paired boundaries so authors can audit the exact source range being waived.

Bad:

What's wrong: The `enable-block` appears without a preceding active `disable-block`.

```adoc
// asciidoclint enable-block AD023
```

Good:

Expected: The block waiver has paired start and end directives.

```adoc
// asciidoclint disable-block AD023 -- intentional placeholder range
== Reserved
// asciidoclint enable-block AD023
```

Implementation note: ADW05 is emitted by the waiver parser when a physical file contains an `enable-block` with no preceding active `disable-block`. ADW diagnostics are always on and are not disabled by rule configuration.
