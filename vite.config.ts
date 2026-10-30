import { writeFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import pkg from "./package.json" with { type: "json" };

// Every dependency and peer stays an import in the output, subpaths too
// (`react/jsx-runtime`, `leaflet/dist/leaflet.css`): the host's bundler
// resolves them once, so there is one React and one QueryClient context.
const external = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)];
const isExternal = (id: string) => external.some((d) => id === d || id.startsWith(`${d}/`));

/**
 * Subpath entry → its source module (without `src/` and the extension). Each is emitted as
 * `dist/<entry>.js`, with `dist/<entry>.d.ts` beside it; `package.json` `exports` maps
 * `@jsudc/react/<entry>` to the pair. The renderers are entries of their own so that the
 * package root imports none of them, and a host installs only the peers of the ones it uses.
 */
const ENTRIES: Record<string, string> = {
  index: "index",
  headless: "headless",
  all: "all",
  table: "table/index",
  cards: "cards/index",
  kanban: "kanban/index",
  calendar: "calendar/index",
  tree: "tree/index",
  map: "map/index",
  chart: "chart/index",
  "schema-editor": "schema-editor/index",
  ui: "ui-kit/ui",
  "react-router": "react-router/index",
};
const FILE_OF_MODULE = Object.fromEntries(
  Object.entries(ENTRIES).map(([entry, mod]) => [mod, `${entry}.js`]),
);

/**
 * `dist/<entry>.d.ts` for an entry whose module sits in a directory: one line pointing at the
 * declarations `tsc` (tsconfig.build.json) writes there.
 */
function entryTypes(): Plugin {
  return {
    name: "jsudc-entry-types",
    apply: "build",
    closeBundle() {
      for (const [entry, mod] of Object.entries(ENTRIES)) {
        if (entry === mod) continue;
        writeFileSync(`dist/${entry}.d.ts`, `export * from "./${mod}";\n`);
      }
    },
  };
}

// Library mode, ESM only, one output file per source module so a host's bundler can drop
// what it does not import. Types come from `tsc` (tsconfig.build.json), the stylesheet from
// the Tailwind CLI (`build:css`).
export default defineConfig({
  plugins: [react(), entryTypes()],
  build: {
    lib: {
      entry: Object.fromEntries(
        Object.entries(ENTRIES).map(([entry, mod]) => [entry, `src/${mod}.ts`]),
      ),
      formats: ["es"],
    },
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    minify: false,
    sourcemap: true,
    rolldownOptions: {
      external: isExternal,
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: (chunk) =>
          chunk.isEntry ? (FILE_OF_MODULE[chunk.name] ?? "[name].js") : "[name].js",
      },
    },
  },
});
