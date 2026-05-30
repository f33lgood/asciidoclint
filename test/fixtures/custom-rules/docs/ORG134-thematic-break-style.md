# ORG134 - thematic-break-style

Tags: organization, style, blocks
Severity: info
Fixability: safe.
Fix helper: Replace the Markdown-compatible thematic break marker with `'''`.

Description: Thematic breaks should use the organization-preferred AsciiDoc-native marker.

Necessity: Asciidoctor accepts both native AsciiDoc thematic breaks and Markdown-compatible thematic breaks. Preferring one form is a source consistency rule, not generic AsciiDoc correctness.

Rationale: This fixture demonstrates how an organization can express a thematic-break style policy without making it an `asciidoclint` built-in. It is experimental test/reference material only, not an official extension pack.

Bad:

What's wrong: The source uses a Markdown-compatible thematic break marker. Asciidoctor renders it correctly, but this fixture pack prefers the native AsciiDoc marker for consistency.

```asciidoc
Before

---

After
```

Good:

Expected: The thematic break uses the organization-preferred AsciiDoc-native marker.

```asciidoc
Before

'''

After
```

Implementation note: This fixture reports `---`, `- - -`, `***`, and `* * *` outside protected blocks and table bodies. It does not report `----` or longer dash runs because those are listing block delimiters, not thematic breaks.
