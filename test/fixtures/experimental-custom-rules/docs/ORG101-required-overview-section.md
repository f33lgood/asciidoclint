# ORG101 - required-overview-section

Tags: organization, conformance
Severity: warning

Description: Documents in this organization should have an `Overview` section.

Necessity: Required sections are a template contract. This rule is useful for product or team document types, but it is not a generic AsciiDoc syntax requirement.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The document has `Details` content but no `Overview` section, so readers and templates cannot rely on the expected introductory section.

```asciidoc
= Title

== Details

Content.
```

Good:

Expected: The document includes an `Overview` section using normal AsciiDoc section syntax.

```asciidoc
= Title

== Overview

Content.
```

Implementation note: This rule uses the normalized document section model and reports once at the document start when no matching section exists.
