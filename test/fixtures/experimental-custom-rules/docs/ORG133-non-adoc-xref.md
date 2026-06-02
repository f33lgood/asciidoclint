# ORG133 - non-adoc-xref

Tags: organization, xref, links
Severity: info

Description: Experimental non-AsciiDoc local files should use `link` instead of `xref`.

Necessity: Some teams want source semantics to match Asciidoctor's documented macro roles: `xref:` for AsciiDoc document references and `link:` for local non-AsciiDoc files. This is weaker than AD044 because local testing shows `xref:datasheet.pdf[]` and `link:datasheet.pdf[]` can render to the same HTML target.

Rationale: This fixture demonstrates a useful style/semantic convention without making it an official built-in rule. It is informational because output is often unaffected.

Bad:

What's wrong: `datasheet.pdf` is not an AsciiDoc source file, so the team convention prefers `link:`.

```asciidoc
xref:datasheet.pdf[Datasheet]
```

Good:

Expected: Local non-AsciiDoc files use `link:`.

```asciidoc
link:datasheet.pdf[Datasheet]
```

Implementation note: This experimental fixture source-scans `xref:` targets with file extensions and ignores `.adoc`, `.asciidoc`, `.asc`, and external URL targets. It is not an official `asciidoclint` extension and should be replaced or configured by a real organization policy pack if a project wants this convention.
