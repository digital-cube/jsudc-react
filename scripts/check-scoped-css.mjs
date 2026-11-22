// Guard for dist/styles.scoped.css (the sheet a host imports when the library must not touch
// its own pages): no selector of it can match an element outside the library's roots.
//
// - No `:root`, `:host`, `html` or `body` anywhere, so no token is declared on the page.
// - Every selector is anchored on a library class (`udc-*`, `udc:*`): walking from its subject
//   to the left through descendant and child combinators, some compound has one, directly or
//   in a `:where()` / `:is()` all of whose alternatives are anchored themselves. A bare
//   element (`h1`), `*` or `::selection` is not; `:where(.udc-data-view, .udc-scope) h1` is.
//   A sibling combinator ends the walk: a sibling of a library element may be the host's.
// - Every class is one check-css.mjs allows (`udc:` utilities, `udc-*`, `.dark`, the map's
//   own state classes), and the tokens are declared on the roots, `.dark` included.
// - No `@property`: a registered custom property exists on every element of the page.
//
// It parses the sheet on its own rather than trusting scope-css.mjs's notion of "anchored".
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { transform } from "lightningcss";

const LIBRARY = /^udc[-:]/;
const ALLOWED = /^(udc:|udc-|dark$|tone-|is-|leaflet-)/;
const FORBIDDEN_TYPES = new Set(["html", "body"]);

function split(selector) {
  const out = [{ combinator: null, parts: [] }];
  for (const c of selector) {
    if (c.type === "combinator") out.push({ combinator: c.value, parts: [] });
    else out[out.length - 1].parts.push(c);
  }
  return out;
}

function libraryCompound(parts) {
  return parts.some(
    (c) =>
      (c.type === "class" && LIBRARY.test(c.name)) ||
      (c.type === "pseudo-class" &&
        (c.kind === "where" || c.kind === "is") &&
        Array.isArray(c.selectors) &&
        c.selectors.length > 0 &&
        c.selectors.every(isAnchored)),
  );
}

function isAnchored(selector) {
  const list = split(selector);
  for (let i = list.length - 1; i >= 0; i--) {
    if (libraryCompound(list[i].parts)) return true;
    const comb = list[i].combinator;
    if (comb !== "descendant" && comb !== "child") return false;
  }
  return false;
}

/** Every component of the selector, nested ones (`:not(…)`, `:where(…)`) included. */
function* walk(selector) {
  for (const c of selector) {
    yield c;
    if (Array.isArray(c.selectors)) for (const s of c.selectors) yield* walk(s);
  }
}

/** The problems of a scoped sheet; empty when it passes. */
export function checkScopedCss(css) {
  const problems = new Set();
  let count = 0;
  let utilities = 0;
  const show = (selector) => JSON.stringify(selector).slice(0, 200);
  transform({
    filename: "styles.scoped.css",
    code: Buffer.from(css),
    visitor: {
      Selector(selector) {
        count++;
        for (const c of walk(selector)) {
          if (c.type === "pseudo-class" && (c.kind === "root" || c.kind === "host")) {
            problems.add(`:${c.kind} in ${show(selector)}`);
          }
          if (c.type === "type" && FORBIDDEN_TYPES.has(c.name)) {
            problems.add(`${c.name} in ${show(selector)}`);
          }
          if (c.type === "class") {
            if (c.name.startsWith("udc:")) utilities++;
            if (!ALLOWED.test(c.name)) problems.add(`class .${c.name} in ${show(selector)}`);
          }
        }
        if (!isAnchored(selector)) problems.add(`not inside a library root: ${show(selector)}`);
      },
    },
  });
  const min = css.replace(/\s+/g, "");
  // A registered custom property exists on every element of the page.
  for (const m of css.matchAll(/@property\s+(--[\w-]+)/g)) problems.add(`@property ${m[1]}`);
  if (count === 0 || utilities === 0) problems.add("no selectors / no udc: utilities");
  if (!/:where\(\.udc-data-view,\.udc-scope\)[^{]*\{[^}]*--background:/.test(min)) {
    problems.add("the tokens are not declared on :where(.udc-data-view, .udc-scope)");
  }
  if (!/\.dark\.udc-data-view[^{]*\{[^}]*--background:/.test(min)) {
    problems.add("the dark tokens are not declared on the roots");
  }
  return [...problems];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file =
    process.argv[2] ?? fileURLToPath(new URL("../dist/styles.scoped.css", import.meta.url));
  const problems = checkScopedCss(readFileSync(file, "utf8"));
  if (problems.length) {
    console.error(`${file}: ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(
    `${file}: every selector is inside .udc-data-view / .udc-scope; no :root, html, body`,
  );
}
