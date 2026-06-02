# ORG125 - strong-style

Tags: organization, inline, style
Severity: info

Description: Strong text should use organization-preferred markers.

Necessity: Strong-text marker choice is a source style convention. Teams can choose a preferred form without making alternatives invalid AsciiDoc.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The sentence uses double asterisks, which this fixture treats as a nonpreferred style.

```asciidoc
This is **important**.
```

Good:

Expected: The sentence uses the organization-preferred strong marker form.

```asciidoc
This is *important*.
```

Implementation note: This fixture prefers constrained strong markers in contexts where they are sufficient for the organization's documents.
