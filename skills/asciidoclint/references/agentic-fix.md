# Agentic Fix Workflow

Use this workflow when the user asks for AI, intelligent, manual, or agentic
repair, especially for findings that do not have deterministic `fix` edits.

Prefer this order:

1. Run lint with JSON output.
2. Apply deterministic safe fixes with `--fix` when the user asked to fix.
3. Rerun lint.
4. Select remaining active findings without safe deterministic fixes.
5. Group findings by physical source file.
6. Read only affected ranges plus nearby context.
7. Use `ruleId`, `alias`, `message`, `detail`, `context`, and `fixHelper` as
   the repair instruction.
8. Apply focused edits.
9. Rerun `asciidoclint`.
10. Report fixed and remaining findings.

Only apply deterministic unsafe fixes when the user explicitly requested unsafe
fixes. AI-authored edits should preserve document meaning unless the finding's
rule requires a semantic change.

Treat `fixHelper` as the primary instruction. Do not invent broad prose,
formatting, or style rewrites unless the reported finding requires them.

When a finding involves a missing dependency, unresolved xref, image alt text,
section hierarchy, or empty section, prefer the smallest repair that makes the
rendered AsciiDoc output trustworthy.
