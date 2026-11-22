// Builds dist/styles.scoped.css from Tailwind's output for src/styles.scoped.css: the same
// sheet as styles.css, with every rule that could reach an element of the host moved inside
// the library's own roots, `.udc-data-view` and `.udc-scope` (the default UI kit's portalled
// content: dialogs, popovers, menus, selects, tooltips, toasts).
//
//   :root, :host, html, body   → :where(.udc-data-view, .udc-scope)   (the tokens, preflight's html)
//   .dark                      → :where(.dark .udc-data-view, …, .udc-data-view.dark, …)
//   *, ::before, [hidden]      → :where(.udc-data-view, …, .udc-data-view *, …)::before
//   h1, button:not(:disabled)  → :where(.udc-data-view, .udc-scope) h1
//
// A selector already anchored on a library class (`.udc:flex`, `.udc-map a`) stays as it is.
// `:where()` adds no specificity, so every rule keeps the weight it has in styles.css.
// scripts/check-scoped-css.mjs then proves no selector of the result can match outside a root.
//
//   node scripts/scope-css.mjs <tailwind output> <scoped sheet>
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { transform } from "lightningcss";

export const ROOT_CLASSES = ["udc-data-view", "udc-scope"];

const cls = (name) => ({ type: "class", name });
const where = (selectors) => ({ type: "pseudo-class", kind: "where", selectors });
const descendant = { type: "combinator", value: "descendant" };
const ROOTS = () => where(ROOT_CLASSES.map((name) => [cls(name)]));

/** A class of the library's own: a `udc:` utility or a stable `udc-*` class. */
export const isLibraryClass = (name) => name.startsWith("udc-") || name.startsWith("udc:");

/** The selector's compounds, left to right, each with the combinator that precedes it. */
export function compounds(selector) {
  const out = [{ combinator: null, parts: [] }];
  for (const c of selector) {
    if (c.type === "combinator") out.push({ combinator: c.value, parts: [] });
    else out[out.length - 1].parts.push(c);
  }
  return out;
}

/** A library class in this compound, directly or inside a `:where()` / `:is()` of it. */
export function compoundHasLibraryClass(parts) {
  return parts.some(
    (c) =>
      (c.type === "class" && isLibraryClass(c.name)) ||
      (c.type === "pseudo-class" &&
        (c.kind === "where" || c.kind === "is") &&
        Array.isArray(c.selectors) &&
        c.selectors.length > 0 &&
        c.selectors.every((s) => anchored(s))),
  );
}

/**
 * Can this selector only match an element of the library? Yes when, walking from the
 * subject to the left through descendant and child combinators only, a compound has a
 * library class: the subject is that element or sits inside it. A sibling combinator
 * ends the walk, since a sibling of a library element may be the host's.
 */
export function anchored(selector) {
  const list = compounds(selector);
  for (let i = list.length - 1; i >= 0; i--) {
    if (compoundHasLibraryClass(list[i].parts)) return true;
    const comb = list[i].combinator;
    if (comb !== "descendant" && comb !== "child") return false;
  }
  return false;
}

const isRootish = (c) =>
  (c.type === "pseudo-class" && (c.kind === "root" || c.kind === "host")) ||
  (c.type === "type" && (c.name === "html" || c.name === "body"));

const ROOTS_AND_INSIDE = () =>
  where([
    ...ROOT_CLASSES.map((name) => [cls(name)]),
    ...ROOT_CLASSES.map((name) => [cls(name), descendant, { type: "universal" }]),
  ]);

/**
 * The selector that replaces `selector` in the scoped sheet, or `undefined` when it is
 * anchored already and stays. Always one selector for one (lightningcss's selector
 * visitor maps one to one), with the roots inside a `:where()` so the weight is unchanged.
 */
export function scopeSelector(selector) {
  if (anchored(selector)) return undefined;
  const [first, ...rest] = compounds(selector);
  const tail = rest.flatMap(({ combinator, parts }) => [
    { type: "combinator", value: combinator },
    ...parts,
  ]);
  // :root / :host / html / body: the roots themselves.
  if (first.parts.length > 0 && first.parts.every(isRootish)) return [ROOTS(), ...tail];
  // The theme switch: a root inside a `.dark` element, or a root that is one.
  if (
    rest.length === 0 &&
    first.parts.length === 1 &&
    first.parts[0].type === "class" &&
    first.parts[0].name === "dark"
  ) {
    return [
      where([
        ...ROOT_CLASSES.map((name) => [cls("dark"), descendant, cls(name)]),
        ...ROOT_CLASSES.map((name) => [cls(name), cls("dark")]),
      ]),
    ];
  }
  // A type selector (`h1`, `button`) is left to the descendants: the roots are the library's divs.
  if (first.parts.some((c) => c.type === "type")) return [ROOTS(), descendant, ...selector];
  // `*`, `::before`, `[hidden]`, `::selection`: the roots and everything inside them.
  const own = first.parts.filter((c) => c.type !== "universal");
  return [ROOTS_AND_INSIDE(), ...own, ...tail];
}

/**
 * Tailwind registers its internal variables (`--tw-shadow`, `--tw-translate-x`, … unprefixed
 * even under `prefix(udc)`) with `@property`, which gives every element of the page, the
 * host's included, those properties. The scoped sheet registers nothing: it drops the
 * `@property` rules and applies the fallback Tailwind ships for browsers without them, the
 * `@layer properties` reset, unconditionally (scoped to the roots like every other rule).
 */
export function dropRegistrations(css) {
  const out = css
    .replace(/@property\s+--[\w-]+\s*\{[^}]*\}/g, "")
    .replace(
      /@layer properties\s*\{\s*@supports[^{]*\{((?:[^{}]*\{[^{}]*\})*)\s*\}\s*\}/,
      "@layer properties{$1}",
    );
  if (/@property\b/.test(out) || /@layer properties\s*\{\s*@supports/.test(out)) {
    throw new Error("scope-css: Tailwind's @property / properties layer changed shape");
  }
  return out;
}

export function scopeCss(code) {
  const { code: out } = transform({
    filename: "styles.scoped.css",
    code: Buffer.from(code),
    minify: true,
    visitor: { Selector: scopeSelector },
  });
  return dropRegistrations(out.toString());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [input, output = input] = process.argv.slice(2);
  if (!input) {
    console.error("usage: node scripts/scope-css.mjs <input.css> [output.css]");
    process.exit(2);
  }
  writeFileSync(output, scopeCss(readFileSync(input, "utf8")));
}
