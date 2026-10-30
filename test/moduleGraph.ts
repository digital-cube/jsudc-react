import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

/** `@dnd-kit/core/x` → `@dnd-kit/core`, `leaflet/dist/leaflet.css` → `leaflet`. */
const packageOf = (spec: string) =>
  spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : (spec.split("/")[0] ?? spec);

function resolveLocal(from: string, spec: string): string {
  const base = resolve(dirname(from), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(c) && !c.endsWith("/")) {
      if (c === base && !/\.(tsx?|css)$/.test(c)) continue;
      return c;
    }
  }
  throw new Error(`cannot resolve ${spec} from ${from}`);
}

/**
 * The runtime imports of one module: `import type` / `export type` are left out (erased),
 * an import whose every specifier is `type` is kept (verbatimModuleSyntax keeps the load).
 */
function runtimeImports(file: string): string[] {
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) && !n.importClause?.isTypeOnly) {
      out.push((n.moduleSpecifier as ts.StringLiteral).text);
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && !n.isTypeOnly) {
      out.push((n.moduleSpecifier as ts.StringLiteral).text);
    } else if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword &&
      n.arguments[0] &&
      ts.isStringLiteral(n.arguments[0])
    ) {
      out.push(n.arguments[0].text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

export interface ModuleGraph {
  /** The modules reached, relative to src/. */
  modules: string[];
  /** Package → the modules (relative to src/) importing it. */
  packages: Map<string, string[]>;
}

/** Every module and package reachable from `entry` (relative to src/) at runtime. */
export function moduleGraph(entry: string): ModuleGraph {
  const seen = new Set<string>();
  const packages = new Map<string, string[]>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (file.endsWith(".css")) return;
    for (const spec of runtimeImports(file)) {
      if (spec.startsWith(".")) walk(resolveLocal(file, spec));
      else {
        const pkg = packageOf(spec);
        packages.set(pkg, [...(packages.get(pkg) ?? []), relative(SRC, file)]);
      }
    }
  };
  walk(resolve(SRC, entry));
  return { modules: [...seen].map((f) => relative(SRC, f)), packages };
}
