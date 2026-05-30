# Prompt: Regenerate report-coverage.md

Regenerate `docs/reports/report-coverage.md` after coverage-affecting code or
test changes.

Run:

```bash
npm run test:coverage
```

Copy the aggregate coverage percentages from the terminal summary into
`docs/reports/report-coverage.md`. Keep the threshold values aligned with
`vitest.config.ts`.
