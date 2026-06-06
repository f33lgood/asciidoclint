# Rule Review Workflow

Use this workflow when deciding whether a rule should exist, where it belongs,
or how its severity, parser, fixability, examples, or helper text should change.

Treat current Asciidoctor documentation and Asciidoctor.js behavior as the
practical language baseline until the AsciiDoc Language Specification is
ratified and precise for the case.

Review in this order:

1. Inspect the rule implementation, docs, tests, config, and examples.
   - For built-ins, check `src/rules/AD###.ts`, `docs/rules/AD###.md`, and
     `docs/rules/rule-necessity.md`.
   - For waiver diagnostics, check `src/rules/ADW##.ts` and
     `docs/rules/ADW##.md`.
   - Search by rule ID and alias with `rg`.
2. Decide the authority: AsciiDoc/Asciidoctor requirement, documented
   recommendation, broad document quality, accessibility, dependency integrity,
   conversion cleanup, or organization policy.
3. Verify Asciidoctor.js behavior locally when the rule depends on parser or
   rendering behavior. Capture whether Asciidoctor emits an error, warning, no
   diagnostic, or silently renders differently from source intent.
4. Decide placement: built-in only for broad AsciiDoc value; custom for
   organization, template, migration, or house-style policy.
5. Check overlap with existing rules by rule ID, alias, tags, and behavior.
6. Confirm parser ownership:
   - prefer Asciidoctor-exposed structure or diagnostics when available;
   - use source scanning only when the needed author intent is otherwise hidden;
   - narrow the rule name and docs to the syntax variants the implementation
     actually covers.
   - if the normalized model does not expose an Asciidoctor-owned fact yet,
     prefer extending the adapter/model over adding a source scanner.
7. Check special document modes and contexts: `article`, `book`, `manpage`,
   wrapper documents, includes, `leveloffset`, comments, protected blocks,
   tables, and source blocks when relevant.
8. Decide severity:
   - `error`: broken or untrustworthy rendering, missing required local
     dependency, invalid structure, or release-gating custom policy;
   - `warning`: likely incomplete, inaccessible, confusing, fragile, or
     documented recommendation;
   - `info`: maintainability, migration, or organization preference.
9. Decide fixability:
   - `safe`: deterministic edit preserves author intent;
   - `unsafe`: plausible edit may change structure, rendered output, paths, or
     author intent;
   - `no`: requires author judgment, missing assets/content, semantic naming, or
     broad restructuring.
10. Check `fixHelper`: it should tell a human or AI exactly how to repair the
    finding. For safe/unsafe fixes, describe the exact edit pattern. For `no`,
    describe the decision the author must make and acceptable repair options.
11. Check docs: necessity, rationale, fixability, fix helper, bad example with
    what is wrong, good example with expected behavior, implementation notes,
    and exceptions.
12. Check tests: at least one bad example, one good example, and edge cases for
    documented exceptions.
13. Sanitize examples inspired by real documents before committing docs,
    reports, fixtures, snapshots, issue drafts, or prompt text. Check diagnostic
    messages, `fixHelper`, fixture filenames, config snippets, and generated
    output for copied source terms, internal paths, private URLs, product names,
    bug IDs, people, usernames, emails, register/interface names, and device
    names.

Report the conclusion with:

- AsciiDoc/Asciidoctor authority and local behavior evidence, when relevant;
- built-in/custom/remove decision;
- severity and rationale;
- parser choice and coverage limits;
- fixability and repair guidance;
- overlap or conflict with other rules;
- required implementation, docs, or test changes.

Keep the report sanitized. Cite rule IDs, aliases, parser surfaces, and line
numbers; redact private source excerpts and absolute paths.
