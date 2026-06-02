# ADW07 - mismatched-waiver-block-rule-list

Tags: waiver
Severity: warning
Fixability: no.
Fix helper: Make the enable-block rule list match the corresponding disable-block rule list exactly.

Description: Waiver enable-block rule lists should match the active disable-block rule list.

Necessity: Mismatched block rule lists make the waiver range ambiguous and can leave authors uncertain which rules were waived.

Rationale: Matching rule lists make paired block waivers mechanically auditable and easier for humans and AI tools to maintain.

Bad:

What's wrong: The block starts with `AD023` but ends with `AD034`.

```adoc
// asciidoclint disable-block AD023
== Reserved
// asciidoclint enable-block AD034
```

Good:

Expected: The `enable-block` repeats the same rule list.

```adoc
// asciidoclint disable-block AD023 -- intentional placeholder range
== Reserved
// asciidoclint enable-block AD023
```

Implementation note: ADW07 is emitted by the waiver parser when an `enable-block` closes a block whose active rule set differs. ADW diagnostics are always on and are not disabled by rule configuration.
