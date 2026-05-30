import fs from "node:fs";
import path from "node:path";

interface PackageJson {
  version?: unknown;
  [key: string]: unknown;
}

const root = process.cwd();
const rootPackageFile = path.join(root, "package.json");
const extensionPackageFile = path.join(root, "packages", "vscode-asciidoclint", "package.json");
const versionFile = path.join(root, "src", "version.ts");
const rootPackage = readJson(rootPackageFile);
const version = rootPackage.version;

if (typeof version !== "string") {
  throw new Error("Root package.json must define a string version");
}

let changed = false;
for (const file of [extensionPackageFile]) {
  const packageJson = readJson(file);
  if (packageJson.version !== version) {
    packageJson.version = version;
    fs.writeFileSync(file, `${JSON.stringify(packageJson, null, 2)}\n`);
    changed = true;
  }
}

const versionSource = `export const VERSION = ${JSON.stringify(version)};\n\nexport function getVersion(): string {\n  return VERSION;\n}\n`;
if (fs.readFileSync(versionFile, "utf8") !== versionSource) {
  fs.writeFileSync(versionFile, versionSource);
  changed = true;
}

if (process.argv.includes("--check")) {
  if (changed) {
    throw new Error(`Package versions were not synchronized with root version ${version}`);
  }
  console.log(`Package versions are synchronized at ${version}`);
} else {
  console.log(`Package versions synchronized at ${version}`);
}

function readJson(file: string): PackageJson {
  return JSON.parse(fs.readFileSync(file, "utf8")) as PackageJson;
}
