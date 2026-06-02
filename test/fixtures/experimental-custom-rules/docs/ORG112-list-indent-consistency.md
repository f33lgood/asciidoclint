# ORG112 - list-indent-consistency

Tags: organization, lists, whitespace
Severity: info

Description: List items at the same marker depth should use consistent indentation.

Necessity: Inconsistent indentation can make nested lists harder to review. Generic AsciiDoc list parsing is marker-based, so exact indentation policy is best kept custom until real fixtures justify core behavior.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The second child item uses a different indent than the previous child at the same marker depth.

```asciidoc
* Item
  ** Child
   ** Misaligned child
```

Good:

Expected: Both child items use the same indentation, making the source structure consistent.

```asciidoc
* Item
  ** Child
  ** Aligned child
```

Implementation note: This fixture checks indentation used for the same marker depth and reports later mismatches.
