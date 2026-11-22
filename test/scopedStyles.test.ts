// The scoped sheet (`@jsudc/react/styles.scoped.css`): built here from src the way `build:css`
// builds it, checked by its guard, and loaded into a page of a host's own: the host's `h1`,
// `button`, `ul`, `html` and `body` compute the same styles with and without it, while the
// data view inside is styled. jsdom applies no `@layer` rule, so the cascade is measured in
// headless Chrome when one is installed (CI's ubuntu runners have it; set CHROME_BIN to
// point at another); the token checks run in jsdom.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const tailwind = join(root, "node_modules/.bin/tailwindcss");
const dir = mkdtempSync(join(tmpdir(), "udc-scoped-"));
const scopedPath = join(dir, "styles.scoped.css");
const defaultPath = join(dir, "styles.css");
let scoped = "";
let unscoped = "";

function node(script: string, ...args: string[]) {
  return spawnSync(process.execPath, [join(root, "scripts", script), ...args], {
    encoding: "utf8",
  });
}

beforeAll(() => {
  execFileSync(tailwind, ["-i", "src/styles.scoped.css", "-o", scopedPath], {
    cwd: root,
    stdio: "pipe",
  });
  const scope = node("scope-css.mjs", scopedPath);
  if (scope.status !== 0) throw new Error(scope.stderr);
  execFileSync(tailwind, ["-i", "src/styles.css", "-o", defaultPath, "--minify"], {
    cwd: root,
    stdio: "pipe",
  });
  scoped = readFileSync(scopedPath, "utf8");
  unscoped = readFileSync(defaultPath, "utf8");
}, 60_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("the guard", () => {
  it("passes the scoped sheet", () => {
    const res = node("check-scoped-css.mjs", scopedPath);
    expect(res.stderr).toBe("");
    expect(res.status).toBe(0);
  });

  it("fails styles.css: preflight, :root tokens and the body rule reach the host", () => {
    const res = node("check-scoped-css.mjs", defaultPath);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(":root");
    expect(res.stderr).toContain("body");
    expect(res.stderr).toContain('not inside a library root: [{"type":"universal"}]');
  });

  it("fails a registered custom property, which every element of the page would get", () => {
    const bad = join(dir, "registered.css");
    writeFileSync(
      bad,
      `${scoped}\n@property --tw-shadow{syntax:"*";inherits:false;initial-value:0 0 #0000}`,
    );
    const res = node("check-scoped-css.mjs", bad);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("@property --tw-shadow");
  });

  it("fails a single unscoped rule added to the scoped sheet", () => {
    const bad = join(dir, "bad.css");
    writeFileSync(bad, `${scoped}\nh1{color:red}`);
    const res = node("check-scoped-css.mjs", bad);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('"name":"h1"');
  });

  it("the scoped sheet has the same utilities as styles.css", () => {
    const utilities = (css: string) =>
      new Set(css.match(/\.udc\\:(?:\\.|[A-Za-z0-9_-])+/g) ?? []).size;
    expect(utilities(scoped)).toBe(utilities(unscoped));
    expect(utilities(scoped)).toBeGreaterThan(500);
  });
});

describe("tokens (jsdom)", () => {
  const styles: HTMLStyleElement[] = [];
  const addStyle = (css: string) => {
    const el = document.createElement("style");
    el.textContent = css;
    document.head.append(el);
    styles.push(el);
  };
  afterEach(() => {
    for (const el of styles.splice(0)) el.remove();
    document.documentElement.className = "";
    document.body.innerHTML = "";
  });

  const token = (el: Element, name: string) =>
    getComputedStyle(el).getPropertyValue(name).replace(/\s+/g, "");

  it("are declared on the data view, not on the page: a host's --background and --primary stay", () => {
    addStyle(":root { --background: rgb(1, 2, 3); --primary: rgb(4, 5, 6); }");
    addStyle(scoped);
    document.body.innerHTML = '<main id="host"><div class="udc-data-view" id="view"></div></main>';
    const html = document.documentElement;
    expect(token(html, "--background")).toBe("rgb(1,2,3)");
    expect(token(html, "--primary")).toBe("rgb(4,5,6)");
    expect(token(document.getElementById("host") as Element, "--primary")).toBe("rgb(4,5,6)");
    const view = document.getElementById("view") as Element;
    expect(token(view, "--primary")).not.toBe("rgb(4,5,6)");
    expect(token(view, "--primary")).toMatch(/oklch/);
    expect(token(view, "--radius")).toBe(".5rem");
  });

  it("and on .udc-scope, the portalled content's root", () => {
    addStyle(scoped);
    document.body.innerHTML = '<div class="udc-scope" id="portal"></div>';
    expect(token(document.getElementById("portal") as Element, "--background")).toMatch(/oklch/);
    expect(token(document.body, "--background")).toBe("");
  });

  it(".dark keeps working: on an ancestor, or on the root itself", () => {
    addStyle(scoped);
    document.body.innerHTML =
      '<div class="udc-data-view" id="light"></div><div class="udc-data-view dark" id="self"></div>';
    const light = token(document.getElementById("light") as Element, "--background");
    const self = token(document.getElementById("self") as Element, "--background");
    expect(self).not.toBe(light);
    document.documentElement.className = "dark";
    expect(token(document.getElementById("light") as Element, "--background")).toBe(self);
    // The dark tokens are not declared on the host's .dark element either.
    expect(token(document.documentElement, "--background")).toBe("");
  });
});

// --- the cascade, in a real browser ---------------------------------------------------

function findChrome(): string | null {
  const candidates = [
    process.env.CHROME_BIN,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ].filter((c): c is string => Boolean(c));
  for (const c of candidates) {
    if (spawnSync(c, ["--version"], { encoding: "utf8" }).status === 0) return c;
  }
  return null;
}
const chrome = findChrome();

const HOST_CSS = `
  body { margin: 24px; font-family: Georgia, serif; color: rgb(20, 30, 40); background: rgb(250, 245, 240); }
  h1 { font-size: 40px; margin: 12px 0; }
  button { padding: 6px 10px; border: 2px solid rgb(200, 0, 0); }
`;

const PAGE_BODY = `
  <h1 id="h1">The host's title</h1>
  <button id="button">The host's button</button>
  <ul id="ul"><li>a host list keeps its bullets</li></ul>
  <div style="height: 300px; width: 600px; overflow: hidden">
  <div class="udc-data-view" id="view">
    <div id="primary" class="udc:bg-primary udc:p-2 udc:rounded-lg udc:shadow-sm">styled</div>
    <ul id="view-ul"><li>reset inside the view</li></ul>
    <h2 id="view-h2">reset inside the view</h2>
  </div>
  </div>
`;

/** Every computed property of each element, custom properties included. */
const MEASURE = `
  const out = {};
  for (const id of ["html", "body", "h1", "button", "ul", "view", "primary", "view-ul", "view-h2"]) {
    const el = id === "html" ? document.documentElement : id === "body" ? document.body : document.getElementById(id);
    const cs = getComputedStyle(el);
    const props = {};
    for (let i = 0; i < cs.length; i++) {
      const name = cs[i];
      props[name] = cs.getPropertyValue(name);
    }
    out[id] = props;
  }
  document.body.setAttribute("data-out", btoa(unescape(encodeURIComponent(JSON.stringify(out)))));
`;

type Measured = Record<string, Record<string, string>>;

function measure(sheet: string, hostCss = HOST_CSS): Measured {
  const page = join(dir, `page-${Math.random().toString(36).slice(2)}.html`);
  writeFileSync(
    page,
    `<!doctype html><html><head><style>${hostCss}</style><style>${sheet}</style></head>` +
      `<body>${PAGE_BODY}<script>${MEASURE}</script></body></html>`,
  );
  const res = spawnSync(
    chrome as string,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      `--user-data-dir=${join(dir, "chrome-profile")}`,
      "--dump-dom",
      `file://${page}`,
    ],
    { encoding: "utf8", timeout: 30_000 },
  );
  const b64 = /data-out="([^"]+)"/.exec(res.stdout)?.[1];
  if (!b64) throw new Error(`no measurement from ${chrome}: ${res.stderr.slice(0, 500)}`);
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as Measured;
}

/** The properties of `id` that differ between two measurements. */
function changed(a: Measured, b: Measured, id: string): string[] {
  const x = a[id] ?? {};
  const y = b[id] ?? {};
  return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => x[k] !== y[k]);
}

describe.skipIf(chrome === null)("a host's page with the scoped sheet (headless Chrome)", () => {
  /** `changed`, without the custom properties (styles.css registers Tailwind's `--tw-*`). */
  const changedStyles = (a: Measured, b: Measured, id: string) =>
    changed(a, b, id).filter((k) => !k.startsWith("--"));
  let bare: Measured;
  let withScoped: Measured;
  let withDefault: Measured;
  beforeAll(() => {
    bare = measure("");
    withScoped = measure(scoped);
    withDefault = measure(unscoped);
  }, 90_000);

  it.each(["html", "body", "h1", "button", "ul"])(
    "the host's %s computes the same styles with and without it",
    (id) => {
      expect(changed(bare, withScoped, id)).toEqual([]);
    },
  );

  it("whereas styles.css restyles the host's own elements (the comparison can tell)", () => {
    expect(changed(bare, withDefault, "h1")).toContain("font-weight");
    expect(changed(bare, withDefault, "body")).toContain("font-size");
    expect(changed(bare, withDefault, "ul")).toContain("list-style-type");
  });

  it("on a page with no CSS of its own, the view computes what it computes with styles.css", () => {
    const scopedAlone = measure(scoped, "");
    const defaultAlone = measure(unscoped, "");
    for (const id of ["view", "primary", "view-ul", "view-h2"]) {
      expect([id, changedStyles(scopedAlone, defaultAlone, id)]).toEqual([id, []]);
    }
  });

  it("the data view inside it is styled", () => {
    const view = withScoped.view ?? {};
    expect(view["font-size"]).toBe("14px");
    expect(view["font-family"]).toMatch(/Inter/);
    expect(view["--primary"]).toMatch(/oklch/);
    const primary = withScoped.primary ?? {};
    expect(primary["background-color"]).not.toBe("rgba(0, 0, 0, 0)");
    expect(primary["background-color"]).not.toBe(bare.primary?.["background-color"]);
    expect(primary["padding-top"]).toBe("8px");
    expect(primary["border-top-left-radius"]).toBe("8px");
    // Preflight applies inside the view only.
    expect(withScoped["view-ul"]?.["list-style-type"]).toBe("none");
    expect(withScoped.ul?.["list-style-type"]).toBe("disc");
    expect(withScoped["view-h2"]?.["font-weight"]).toBe("400");
    expect(primary["box-shadow"]).not.toBe("none");
    // The page's background is the host's: a root paints none of its own.
    expect(view["background-color"]).toBe("rgba(0, 0, 0, 0)");
  });
});
