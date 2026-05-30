# ORG118 - no-heading-trailing-punctuation

Tags: organization, headings, style
Severity: info

Description: Section titles should not end with punctuation.

Necessity: Heading punctuation is editorial style. Teams may ban it for cleaner generated anchors, TOCs, and visual consistency.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The heading ends with a colon, which violates this style policy.

```asciidoc
== Overview:
```

Good:

Expected: The heading text omits trailing punctuation while keeping the same title.

```asciidoc
== Overview
```

Implementation note: This fixture uses parsed section titles and reports titles ending in punctuation.
