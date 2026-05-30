# AI Repair Policy

Prefer deterministic fixes first:

1. Safe automatic fixes.
2. Explicit unsafe automatic fixes only when requested.
3. AI-assisted edits for remaining findings.

For AI-assisted edits, treat `fixHelper` as the primary instruction. Preserve
document meaning unless the rule explicitly requires a semantic change. Rerun
`asciidoclint` after edits and report remaining findings.
