// Guard for dist/styles.css: every class selector is a `udc:` utility, a stable `udc-*`
// class, the `.dark` theme switch, or a state/third-party class only ever used under
// `.udc-map` (`tone-*`, `is-*`, `leaflet-*`). An unprefixed Tailwind utility (`.flex`,
// `.p-4`) would style the host's own markup, so it fails the build. And the radius and
// fonts stay runtime tokens: the sheet reads `var(--radius)` / `var(--font-sans)`, and
// the only literal font or radius is the `:root` default (plus preflight's reset to 0).
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../dist/styles.css", import.meta.url), "utf8");
const css = raw
  // strip comments, url(...) and strings: `.w3.org` inside a data URI is not a selector
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/url\([^)]*\)/g, "")
  .replace(/"[^"]*"|'[^']*'/g, "");
const selectors = css.match(/\.(?:\\.|[A-Za-z0-9_-])+/g) ?? [];
const allowed = /^\.(udc\\:|udc-|dark$|tone-|is-|leaflet-)/;
const bad = [...new Set(selectors.filter((s) => !/^\.\d/.test(s) && !allowed.test(s)))];
const prefixed = selectors.filter((s) => s.startsWith(".udc\\:")).length;
if (bad.length || prefixed === 0) {
  console.error(
    `dist/styles.css: ${prefixed} udc: utilities; unexpected selectors: ${bad.join(" ")}`,
  );
  process.exit(1);
}

// The `:root` that declares the defaults; every other rule must not repeat them.
const rootDefaults = raw.match(/:root\{--radius:[^}]*\}/)?.[0] ?? "";
const rest = raw.replace(rootDefaults, "");
const tokenProblems = [
  !rootDefaults && "no :root rule declaring --radius",
  !rest.includes("var(--radius") && "no rule reads var(--radius)",
  !rest.includes("var(--font-sans") && "no rule reads var(--font-sans)",
  !rest.includes("var(--font-mono") && "no rule reads var(--font-mono)",
  /Inter/.test(rest) && "a literal Inter font outside the :root default",
  /--udc-(radius-|font-sans|font-mono)/.test(rest) &&
    "a --udc-radius-* or --udc-font-sans/mono variable",
  ...[
    ...new Set(
      rest.match(
        /border-radius:(?!0[;}]|3\.4\d*e38px|calc\(var\(--radius\)|var\(--radius\))[^;}]*/g,
      ) ?? [],
    ),
  ].map((d) => `a literal radius (${d})`),
].filter(Boolean);
if (tokenProblems.length) {
  console.error(`dist/styles.css: ${tokenProblems.join("; ")}`);
  process.exit(1);
}
console.log(
  `dist/styles.css: ${prefixed} udc: utility selectors, no unprefixed class, radius and fonts from tokens`,
);
