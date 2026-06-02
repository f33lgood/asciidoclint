# ADW02 - missing-waiver-rule-list

Tags: waiver
Severity: warning
Fixability: no.
Fix helper: Add the exact rule ID or IDs that the waiver is intended to cover.

Description: Waiver directives should name at least one rule ID.

Necessity: A waiver without a rule list has unclear intent and can be mistaken for a broad or global disable.

Rationale: Rule-ID scoped waivers keep suppression auditable and prevent accidental broad waivers.

Bad:

What's wrong: The directive does not name any rule IDs.

```adoc
// asciidoclint disable-next-line
```

Good:

Expected: The waiver names the exact rule it covers.

```adoc
// asciidoclint disable-next-line AD023 -- intentional placeholder
== Reserved
```

Implementation note: ADW02 is emitted by the waiver parser when the supported directive has no rule list. ADW diagnostics are always on and are not disabled by rule configuration.
