# Experimental Custom Rule Fixtures

This directory contains experimental custom-rule fixtures used by the test
suite.

These `ORG###` rules are not official `asciidoclint` extensions, not a
recommended organization policy pack, and not part of the public built-in rule
set. They exist to prove that custom rules can be loaded, documented, tested,
and mapped from reference-tool ideas without modifying `asciidoclint` source.

- `src/` contains loadable custom rule implementations.
- `docs/` contains the matching per-rule documentation.

The separation mirrors the shape a real organization policy pack could use:
executable rules and human-readable/AI-readable rule guidance live together
outside `asciidoclint` built-in source.
