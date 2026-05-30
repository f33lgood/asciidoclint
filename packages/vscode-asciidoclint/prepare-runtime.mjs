import fs from "node:fs";
import path from "node:path";

const packageRoot = new URL(".", import.meta.url).pathname;
const repoRoot = path.resolve(packageRoot, "../..");
const runtimeRoot = path.join(packageRoot, "dist", "node_modules");
const runtimePackages = new Set([
  "asciidoctor",
  "@asciidoctor/core",
  "@asciidoctor/opal-runtime",
]);

fs.rmSync(runtimeRoot, { recursive: true, force: true });
for (const packageName of [...runtimePackages]) {
  copyPackageWithDependencies(packageName);
}

function copyPackageWithDependencies(packageName) {
  if (!runtimePackages.has(packageName)) {
    runtimePackages.add(packageName);
  }
  const source = path.join(repoRoot, "node_modules", ...packageName.split("/"));
  const destination = path.join(runtimeRoot, ...packageName.split("/"));
  if (fs.existsSync(destination)) {
    return;
  }
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, {
    recursive: true,
    dereference: true,
    filter: (file) => !file.includes(`${path.sep}.cache${path.sep}`),
  });
  const manifest = JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf8"));
  for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
    copyPackageWithDependencies(dependencyName);
  }
}
