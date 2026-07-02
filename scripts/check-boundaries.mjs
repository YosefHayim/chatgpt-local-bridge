#!/usr/bin/env node
// Enforce the feature boundary: no file under src/features/<A> may import another
// feature <B>'s *.class.ts. Cross-feature access goes through create-*.factory.ts or
// a feature's declared public module. See CODE-STYLE.md and ADR 0002.
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");
const FEATURES_ROOT = join(REPO_ROOT, "src", "features");
const IMPORT_RE = /(?:import|export)\b[\s\S]*?\bfrom\s*["']([^"']+)["']/g;

/** The top-level feature a path belongs to, or null if outside src/features. */
function featureOf(absPath) {
  const rel = relative(FEATURES_ROOT, absPath);
  if (rel.startsWith("..")) return null;
  return rel.split(sep)[0];
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const files = await walk(FEATURES_ROOT);
const violations = [];

for (const file of files) {
  const srcFeature = featureOf(file);
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(IMPORT_RE)) {
    const spec = match[1];
    if (!spec.startsWith(".")) continue;
    if (!spec.endsWith(".class.ts")) continue;
    const targetFeature = featureOf(resolve(dirname(file), spec));
    if (targetFeature && targetFeature !== srcFeature) {
      violations.push(
        `${relative(REPO_ROOT, file)} → ${spec}  (cross-feature .class.ts; import via ${targetFeature}/create-*.factory.ts)`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("Feature-boundary violations (no cross-feature *.class.ts imports):\n");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log(`check-boundaries: OK (${files.length} files)`);
