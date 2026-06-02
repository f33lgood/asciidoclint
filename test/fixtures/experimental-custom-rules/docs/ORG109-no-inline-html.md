# ORG109 - no-inline-html

Tags: organization, html, conversion
Severity: info

Description: Raw inline HTML should not be used in this organization.

Necessity: AsciiDoc supports passthroughs and backend markup, but many source repositories ban raw HTML for portability and reviewability.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The line embeds a raw `<span>` tag, tying the source to HTML output and bypassing AsciiDoc semantics.

```asciidoc
Use <span class="warn">caution</span> here.
```

Good:

Expected: The line uses native AsciiDoc role syntax for the same visible emphasis.

```asciidoc
Use [.warn]#caution# here.
```

Implementation note: This fixture detects simple raw HTML tags in text. A production version should skip approved passthrough or source contexts.
