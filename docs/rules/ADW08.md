# ADW08 - waiver-targets-waiver-rule

Tags: waiver
Severity: warning
Fixability: no.
Fix helper: Remove ADW## IDs from the waiver rule list and fix the waiver directive syntax instead.

Description: Source waivers should not target ADW waiver diagnostics.

Necessity: Waiver syntax diagnostics protect the integrity of the waiver system. They must remain visible when waiver syntax is malformed or overbroad.

Rationale: Allowing source waivers to suppress ADW diagnostics would make it possible for malformed waiver controls to hide their own defects.

Bad:

What's wrong: The waiver attempts to target an ADW diagnostic.

```adoc
// asciidoclint disable-next-line ADW01 -- invalid waiver target
```

Good:

Expected: The waiver targets a normal lint rule, not a waiver-system diagnostic.

```adoc
// asciidoclint disable-next-line AD023 -- intentional placeholder
== Reserved
```

Implementation note: ADW08 is emitted by the waiver parser when any waiver rule list includes an `ADW##` ID. ADW diagnostics are always on, are not disabled by rule configuration, and cannot be waived.
