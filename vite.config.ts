import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

// Every dependency and peer stays an import in the output, subpaths too
// (`react/jsx-runtime`, `leaflet/dist/leaflet.css`): the host's bundler
// resolves them once, so there is one React and one QueryClient context.
const external = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)];
const isExternal = (id: string) => external.some((d) => id === d || id.startsWith(`${d}/`));

// The subpath entries live in their own directories; they are emitted at the top of dist/.
const ENTRY_FILES: Record<string, string> = {
  "ui-kit/ui": "ui.js",
  "react-router/index": "react-router.js",
};

// Library mode, ESM only, one output file per source module so a host's
// bundler can drop what it does not import. Three entries: the package,
// `@jsudc/react/ui` (dist/ui.js: the default UI kit and the Radix primitives)
// and `@jsudc/react/react-router` (dist/react-router.js), the only module that
// imports react-router. Types come from `tsc`
// (tsconfig.build.json), the stylesheet from the Tailwind CLI (`build:css`).
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
        ui: "src/ui-kit/ui.ts",
        "react-router": "src/react-router/index.ts",
      },
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
          chunk.isEntry ? (ENTRY_FILES[chunk.name] ?? "[name].js") : "[name].js",
      },
    },
  },
});
