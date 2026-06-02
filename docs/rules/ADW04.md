# ADW04 - unknown-waiver-rule-id

Tags: waiver
Severity: warning
Fixability: no.
Fix helper: Correct the rule ID or remove it from the waiver if no such rule exists.

Description: Waiver rule lists should only reference defined rule IDs.

Necessity: Unknown rule IDs make waivers ineffective and can hide typos in waiver exceptions.

Rationale: Reporting unknown waiver targets helps authors keep waivers synchronized with the active rule set and custom rules.

Bad:

What's wrong: `AD999` is not a defined rule ID.

```adoc
// asciidoclint disable-next-line AD999
```

Good:

Expected: The waiver names a defined rule ID.

```adoc
// asciidoclint disable-next-line AD023 -- intentional placeholder
== Reserved
```

Implementation note: ADW04 is emitted by the waiver parser after loading built-in and configured custom rule IDs. ADW diagnostics are always on and are not disabled by rule configuration.
