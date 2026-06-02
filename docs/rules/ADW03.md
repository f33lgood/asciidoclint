# ADW03 - malformed-waiver-rule-list

Tags: waiver
Severity: warning
Fixability: no.
Fix helper: Rewrite the rule list as comma-separated rule IDs, for example AD023, AD014.

Description: Waiver rule lists should be comma-separated rule IDs.

Necessity: A malformed rule list cannot be interpreted reliably, so the waiver parser must not guess author intent.

Rationale: A strict rule-list grammar keeps waiver behavior deterministic in CLI output, editor diagnostics, and AI-authored edits.

Bad:

What's wrong: The rule IDs are separated by whitespace instead of a comma.

```adoc
// asciidoclint disable-next-line AD023 AD014
```

Good:

Expected: Multiple rule IDs are comma-separated.

```adoc
// asciidoclint disable-next-line AD023, AD014 -- documented exception
== Reserved
```

Implementation note: ADW03 is emitted by the waiver parser before rule IDs are matched to known rules. ADW diagnostics are always on and are not disabled by rule configuration.
