// Guard for dist/styles.css, the other way round from check-css.mjs: every `udc:` class
// the sources use must produce a rule in the sheet. Tailwind silently emits nothing for
// a utility whose token the theme does not define (`udc:bg-popover` with no
// `--color-popover`), so a typo or a missing token ships as an element with no
// background. This fails the build instead.
//
// A candidate is a `udc:` token in a string of a non-test source file. Tokens built at
// run time (`udc:paging:${id}`) are storage keys, not classes, and are skipped; a
// class name assembled from pieces is invisible to Tailwind as well, so the sources do
// not do that.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const css = readFileSync(join(root, "dist/styles.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/url\([^)]*\)/g, "")
  // strings, but not the escaped quotes of a selector like `.udc\:content-\[\'\*\'\]`
  .replace(/(?<!\\)"(?:\\.|[^"\\])*"|(?<!\\)'(?:\\.|[^'\\])*'/g, "");

// Every class the sheet has a selector for, unescaped: `.udc\:bg-surface-raised` →
// `udc:bg-surface-raised`, `.udc\:w-\[12rem\]` → `udc:w-[12rem]`.
const emitted = new Set(
  (css.match(/\.(?:\\.|[A-Za-z0-9_-])+/g) ?? []).map((s) => s.slice(1).replace(/\\(.)/g, "$1")),
);

function* sources(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* sources(p);
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) yield p;
  }
}

// `udc:` at a word boundary, then anything up to whitespace, a quote or a backtick;
// a bracketed arbitrary value (`content-['*']`) may hold any of those but whitespace.
const candidate = /(?<![\w:-])udc:(?:\[[^\]\s]*\]|[^\s"'`[\]{}<>])+/g;
// `group`, `peer` and their named forms are markers for `group-hover:` / `peer-checked:`
// and never get a rule of their own.
const marker = /^udc:(group|peer)(\/[\w-]+)?$/;
const missing = new Map();
let used = 0;
for (const file of sources(join(root, "src"))) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(candidate)) {
    const cls = m[0].replace(/[.,;)]+$/, "");
    // `udc:paging:${id}`, `udc:tree:<key>`: a storage key, not a class
    if (/[:$]$/.test(cls) || /^[{<]/.test(text[m.index + m[0].length] ?? "")) continue;
    used++;
    if (emitted.has(cls) || marker.test(cls)) continue;
    const at = `${file.slice(root.length)}:${text.slice(0, m.index).split("\n").length}`;
    missing.set(cls, [...(missing.get(cls) ?? []), at]);
  }
}

if (missing.size || used === 0) {
  console.error(
    `dist/styles.css: ${missing.size} udc: class(es) used in src produce no rule` +
      " (a theme token missing from tokens.css, or a typo):",
  );
  for (const [cls, at] of missing) console.error(`  ${cls}  ${at.join(", ")}`);
  process.exit(1);
}
console.log(`dist/styles.css: all ${used} udc: class uses in src produce a rule`);
