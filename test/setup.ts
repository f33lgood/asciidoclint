import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-test-home-"));

process.env.HOME = home;
process.env.USERPROFILE = home;
