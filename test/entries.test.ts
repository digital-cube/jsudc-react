// @vitest-environment node
import { describe, expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };
import { moduleGraph } from "./moduleGraph";

// The peers only a renderer needs: optional, each reached from its own subpath alone.
const RENDERER_PEERS = [
  "@tanstack/react-table",
  "@dnd-kit/core",
  "@dnd-kit/sortable",
  "@dnd-kit/utilities",
  "leaflet",
  "recharts",
];

/** Subpath → its source entry and the optional peers it may import. */
const ENTRIES: Record<string, { src: string; peers: string[] }> = {
  ".": { src: "index.ts", peers: [] },
  "./table": { src: "table/index.ts", peers: ["@tanstack/react-table"] },
  "./cards": { src: "cards/index.ts", peers: [] },
  "./kanban": {
    src: "kanban/index.ts",
    peers: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
  },
  "./calendar": { src: "calendar/index.ts", peers: [] },
  "./tree": { src: "tree/index.ts", peers: ["@dnd-kit/core"] },
  "./map": { src: "map/index.ts", peers: ["leaflet"] },
  "./chart": { src: "chart/index.ts", peers: ["recharts"] },
  "./schema-editor": { src: "schema-editor/index.ts", peers: [] },
  "./all": { src: "all.ts", peers: RENDERER_PEERS },
};

describe("@jsudc/react/headless", () => {
  const g = moduleGraph("headless.ts");

  it("imports no renderer peer, no UI primitive library and no icon set", () => {
    const forbidden = [...RENDERER_PEERS, "radix-ui", "lucide-react", "marked"];
    const found = Object.fromEntries([...g.packages].filter(([p]) => forbidden.includes(p)));
    expect(found).toEqual({});
  });

  it("reaches no JSX module, no stylesheet and nothing of the UI kit", () => {
    const markup = g.modules.filter(
      (m) => m.endsWith(".tsx") || m.endsWith(".css") || /^(components|ui-kit)\//.test(m),
    );
    expect(markup).toEqual([]);
  });

  it("needs only react, react-query and @jsudc/core", () => {
    expect([...g.packages.keys()].sort()).toEqual([
      "@jsudc/core",
      "@tanstack/react-query",
      "react",
    ]);
  });
});

describe("the renderer subpaths", () => {
  for (const [subpath, { src, peers }] of Object.entries(ENTRIES)) {
    it(`${subpath} imports no optional peer but its own`, () => {
      const used = [...moduleGraph(src).packages.keys()].filter((p) => RENDERER_PEERS.includes(p));
      expect(used.sort()).toEqual([...peers].sort());
    });
  }

  it("the main entry reaches no renderer module", () => {
    const renderers = moduleGraph("index.ts").modules.filter((m) =>
      /^(table\/TableRenderer|cards\/CardRenderer|kanban\/KanbanRenderer|calendar\/CalendarRenderer|tree\/TreeRenderer|map\/MapRenderer|chart\/ChartRenderer)\.tsx$/.test(
        m,
      ),
    );
    expect(renderers).toEqual([]);
  });

  it("package.json exports every subpath, and marks the renderer peers optional", () => {
    for (const subpath of Object.keys(ENTRIES)) expect(pkg.exports).toHaveProperty([subpath]);
    expect(pkg.exports).toHaveProperty(["./headless"]);
    for (const peer of RENDERER_PEERS) {
      expect(pkg.peerDependencies).toHaveProperty([peer]);
      expect(pkg.peerDependenciesMeta).toHaveProperty([peer, "optional"], true);
    }
  });
});
