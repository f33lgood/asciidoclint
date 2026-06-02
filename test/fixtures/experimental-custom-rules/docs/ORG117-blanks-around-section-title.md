# ORG117 - blanks-around-section-title

Tags: organization, headings, whitespace
Severity: info

Description: Section titles should be surrounded by blank lines.

Necessity: AsciiDoc can parse headings without surrounding blank lines, but source spacing rules improve reviewability and reduce accidental paragraph attachment.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The heading is attached directly to surrounding paragraphs in source.

```asciidoc
Text.
== Next
More text.
```

Good:

Expected: The heading has blank lines before and after it, making the section boundary clear.

```asciidoc
Text.

== Next

More text.
```

Implementation note: This fixture requires a blank line before and after section titles except for the first document title.
