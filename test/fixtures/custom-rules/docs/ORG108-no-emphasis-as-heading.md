# ORG108 - no-emphasis-as-heading

Tags: organization, headings, conversion
Severity: info

Description: Standalone emphasized text should not be used as a heading.

Necessity: Standalone emphasis is sometimes intentional, but converted documents often use it as a fake heading. Teams can enforce real section syntax for navigable structure.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: `*Overview*` looks like a heading in source but renders as a paragraph, so it is not part of the document outline.

```asciidoc
*Overview*

Content.
```

Good:

Expected: `== Overview` creates a real section title that appears in navigation and structure checks.

```asciidoc
== Overview

Content.
```

Implementation note: This fixture scans for lines containing only emphasis markup and recommends real section syntax.
