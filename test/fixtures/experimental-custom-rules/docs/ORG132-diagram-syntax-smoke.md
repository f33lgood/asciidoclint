# ORG132 - diagram-syntax-smoke

Tags: organization, diagram
Severity: warning

Description: Experimental diagram blocks should pass lightweight organization syntax smoke checks.

Necessity: Diagram engines are external to core AsciiDoc. A team may still want cheap preflight checks before invoking PlantUML, Mermaid, WaveDrom, Kroki, or another renderer in CI, but those checks are engine-version and project-policy dependent.

Rationale: This fixture demonstrates why diagram-language syntax checks belong in loadable custom rules instead of `asciidoclint` built-ins. The built-in linter uses Asciidoctor.js to identify diagram blocks and generic document structure; production diagram syntax validation should be owned by the real diagram renderer or a maintained parser for that diagram language.

Bad:

What's wrong: The PlantUML block omits the wrapper lines that this organization requires before accepting a diagram source file.

```asciidoc
[plantuml]
----
Alice -> Bob
----
```

Good:

Expected: The diagram source follows the organization's PlantUML wrapper convention.

```asciidoc
[plantuml]
----
@startuml
Alice -> Bob
@enduml
----
```

Implementation note: This fixture intentionally uses lightweight heuristics for PlantUML, Mermaid, and WaveDrom so tests can prove custom-rule loading. It is not a production recommendation and should be replaced by real renderer/parser integration when a project needs authoritative diagram validation.
