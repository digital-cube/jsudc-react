// Guard for dist/styles.css: every class selector is a `udc:` utility, a stable `udc-*`
// class, the `.dark` theme switch, or a state/third-party class only ever used under
// `.udc-map` (`tone-*`, `is-*`, `leaflet-*`). An unprefixed Tailwind utility (`.flex`,
// `.p-4`) would style the host's own markup, so it fails the build.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../dist/styles.css", import.meta.url), "utf8")
  // strip comments, url(...) and strings: `.w3.org` inside a data URI is not a selector
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/url\([^)]*\)/g, "")
  .replace(/"[^"]*"|'[^']*'/g, "");
const selectors = css.match(/\.(?:\\.|[A-Za-z0-9_-])+/g) ?? [];
const allowed = /^\.(udc\\:|udc-|dark$|tone-|is-|leaflet-)/;
const bad = [...new Set(selectors.filter((s) => !/^\.\d/.test(s) && !allowed.test(s)))];
const prefixed = selectors.filter((s) => s.startsWith(".udc\\:")).length;
if (bad.length || prefixed === 0) {
  console.error(`dist/styles.css: ${prefixed} udc: utilities; unexpected selectors: ${bad.join(" ")}`);
  process.exit(1);
}
console.log(`dist/styles.css: ${prefixed} udc: utility selectors, no unprefixed class`);
