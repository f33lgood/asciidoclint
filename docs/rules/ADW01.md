# ADW01 - unknown-waiver-directive

Tags: waiver
Severity: warning
Fixability: no.
Fix helper: Replace the directive name with disable-next-line, disable-block, or enable-block.

Description: Waiver directives should use a supported asciidoclint directive name.

Necessity: Unknown waiver directives are ignored by the waiver parser. The author may believe a finding is waived when no supported waiver was applied.

Rationale: Source waivers are audit controls. Unknown directive names should be visible as lint findings so waiver intent is not silently lost.

Bad:

What's wrong: `disable` is not a supported waiver directive.

```adoc
// asciidoclint disable AD023
```

Good:

Expected: The directive uses the supported `disable-next-line` form and names the target rule.

```adoc
// asciidoclint disable-next-line AD023 -- intentional placeholder
== Reserved
```

Implementation note: ADW01 is emitted by the waiver parser, not by the rule function. The rule file provides registry metadata, examples, documentation, and discoverability. ADW diagnostics are always on and are not disabled by rule configuration.
