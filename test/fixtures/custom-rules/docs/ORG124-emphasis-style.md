# ORG124 - emphasis-style

Tags: organization, inline, style
Severity: info

Description: Emphasis should use organization-preferred markers.

Necessity: AsciiDoc supports more than one emphasis form. A style guide can choose one form for consistency, but the syntax itself is valid.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The sentence uses underscore emphasis, which this organization does not prefer.

```asciidoc
This is _important_.
```

Good:

Expected: The sentence uses the preferred emphasis marker while preserving the same rendered meaning.

```asciidoc
This is *important*.
```

Implementation note: This fixture prefers one organization-selected marker style; AsciiDoc itself permits more than one emphasis form.
