# Brand assets

| File | Purpose |
| --- | --- |
| **`logo.svg`** | README, GitLab/GitHub, npm (includes **lint** text) |
| **`icon.svg`** | VS Code extension (`packages/vscode-asciidoclint/media/icon.svg`) — same as logo, no text |

Both SVGs were created with [Inkscape](https://inkscape.org/). The **lint** label in `logo.svg` uses [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (SIL Open Font License).

When editing, open `logo.svg` in Inkscape. If the mark changes, update `icon.svg` as well (remove the `<text>…</text>` block, or hide the text layer and save a copy). For distribution without a font dependency, convert the text to paths (**Path → Object to Path**) before committing.

MIT — same as the project.
