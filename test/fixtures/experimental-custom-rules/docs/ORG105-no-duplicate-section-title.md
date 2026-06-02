# ORG105 - no-duplicate-section-title

Tags: organization, headings
Severity: info

Description: Section titles should be unique in this documentation set.

Necessity: Duplicate section titles can be valid, but they can also create ambiguous generated anchors, search results, and review comments. Teams may require uniqueness for navigation clarity.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: Two sibling sections use the same visible title, making references to “Details” ambiguous.

```asciidoc
= Title

== Details

== Details
```

Good:

Expected: The sections use distinct titles that preserve the intended meaning and reduce anchor ambiguity.

```asciidoc
= Title

== Hardware Details

== Software Details
```

Implementation note: This rule normalizes section titles into simple slugs and reports the later duplicate.
