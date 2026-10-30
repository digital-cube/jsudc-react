import { type DescribeResponse, SchemaDocSchema, ViewConfigSchema } from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cardsRenderer } from "../src/cards";
import { UdcDataView } from "../src/data-view/UdcDataView";
import { UdcI18nProvider } from "../src/i18n/i18n";
import { createRendererRegistry, rendererEntry } from "../src/renderers/registry";
import type { RendererRegistry } from "../src/renderers/types";
import { tableRenderer } from "../src/table";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { Toaster, TooltipProvider } from "../src/ui-kit/ui";
import { listOf, mockUdcFetch, row } from "./fetchMock";

const describeCompanies: DescribeResponse = {
  collection: "companies",
  capabilities: {
    mutate: false,
    subscribe: false,
    total_count: true,
    schema_edit: false,
    config_edit: false,
    reindex: false,
    tree_reparent: false,
    source_yaml: false,
    supported_filter_ops: [],
  },
  schema: SchemaDocSchema.parse({
    version: "v1",
    fields: { name: { type: "string" }, lat: { type: "decimal" }, lng: { type: "decimal" } },
  }),
  view: ViewConfigSchema.parse({
    available_renderers: ["table", "cards", "map"],
    columns: [{ field: "name" }],
    card_options: { title_field: "name" },
    map_options: { lat_field: "lat", lng_field: "lng" },
  }),
  filterable: { fields: [] },
  source_kind: "postgres_jsonb",
};

function mount(tab: string, renderers?: RendererRegistry) {
  window.history.replaceState(null, "", `/?tab=${tab}`);
  const mock = mockUdcFetch({
    describe: () => ({ ok: describeCompanies }),
    list: () => ({ ok: listOf([row("c1", 1, { name: "Acme", lat: 44.8, lng: 20.46 })]) }),
  });
  const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
  render(
    <UdcI18nProvider>
      <UdcProvider client={client} {...(renderers ? { renderers } : {})}>
        <QueryClientProvider client={createUdcQueryClient()}>
          <TooltipProvider>
            <Toaster>
              <UdcDataView collection="companies" />
            </Toaster>
          </TooltipProvider>
        </QueryClientProvider>
      </UdcProvider>
    </UdcI18nProvider>,
  );
}

afterEach(() => window.history.replaceState(null, "", "/"));

describe("createRendererRegistry", () => {
  it("maps each definition's name to its entry; a later one of the same name wins", () => {
    const custom = { ...cardsRenderer, labelKey: "TAB_GALLERY" };
    const registry = createRendererRegistry(tableRenderer, cardsRenderer, custom);
    expect(Object.keys(registry)).toEqual(["table", "cards"]);
    expect(rendererEntry(registry, "cards")?.labelKey).toBe("TAB_GALLERY");
    expect(rendererEntry(registry, "table")).not.toHaveProperty("name");
    expect(Object.isFrozen(registry)).toBe(true);
  });
});

describe("the data view draws only the registered renderers", () => {
  it("with a hand-built registry of two: their tabs work, the unregistered map is disabled", async () => {
    mount("cards", createRendererRegistry(tableRenderer, cardsRenderer));
    expect(await screen.findByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("tab-table")).not.toBeDisabled();
    expect(screen.getByTestId("tab-map")).toBeDisabled();
  });

  it("a requested tab that is not registered falls back to a registered one", async () => {
    mount("map", createRendererRegistry(tableRenderer, cardsRenderer));
    expect(await screen.findByTestId("udc-table")).toBeInTheDocument();
  });

  it("with no registry it says no renderer is registered instead of loading forever", async () => {
    mount("table");
    expect(await screen.findByTestId("no-renderer")).toHaveTextContent(
      "No renderer is registered for table",
    );
  });
});
