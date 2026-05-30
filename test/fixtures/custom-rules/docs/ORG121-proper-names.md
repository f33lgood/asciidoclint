# ORG121 - proper-names

Tags: organization, style
Severity: info

Description: Configured proper names should use preferred capitalization.

Necessity: Terminology capitalization is organization-specific and often changes with product branding. It belongs in a custom rule pack backed by a team vocabulary.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The sentence uses lowercase forms for proper names that the organization wants capitalized.

```asciidoc
examplecorp supports asciidoc workflows.
```

Good:

Expected: The sentence uses the preferred capitalization for both terms.

```asciidoc
ExampleCorp supports AsciiDoc workflows.
```

Implementation note: This fixture checks a tiny example vocabulary; real packs would load a team-owned terminology list.
