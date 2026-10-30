import { type DescribeResponse, type Row, SchemaDocSchema, ViewConfigSchema } from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RENDERERS } from "../src/all";
import { UdcDataView } from "../src/data-view/UdcDataView";
import { UdcI18nProvider } from "../src/i18n/i18n";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { listOf, mockUdcFetch, row } from "./fetchMock";
import { stubKit } from "./stubKit";

// Every module of the default kit is replaced by one whose exports throw when
// rendered. Under the stub kit a renderer that still reached a Radix primitive,
// through the context's default or a stray import, fails the test.
const { leaked } = vi.hoisted(() => ({
  leaked: (mod: string) =>
    new Proxy(
      {},
      {
        has: (_, key) => key !== "then",
        get: (_, key) =>
          key === "then" || typeof key === "symbol"
            ? undefined
            : () => {
                throw new Error(`default kit leaked: components/ui/${mod} ${String(key)}`);
              },
      },
    ),
}));
vi.mock("../src/components/ui/button", () => leaked("button"));
vi.mock("../src/components/ui/checkbox", () => leaked("checkbox"));
vi.mock("../src/components/ui/dialog", () => leaked("dialog"));
vi.mock("../src/components/ui/dropdown-menu", () => leaked("dropdown-menu"));
vi.mock("../src/components/ui/input", () => leaked("input"));
vi.mock("../src/components/ui/misc", () => leaked("misc"));
vi.mock("../src/components/ui/popover", () => leaked("popover"));
vi.mock("../src/components/ui/segmented", () => leaked("segmented"));
vi.mock("../src/components/ui/select", () => leaked("select"));
vi.mock("../src/components/ui/toast", () => leaked("toast"));
vi.mock("../src/components/ui/tooltip", () => leaked("tooltip"));

const capabilities = {
  mutate: true,
  subscribe: false,
  total_count: true,
  schema_edit: false,
  config_edit: false,
  reindex: true,
  tree_reparent: false,
  source_yaml: false,
  supported_filter_ops: [],
};

function describeOf(
  collection: string,
  fields: Record<string, unknown>,
  view: Record<string, unknown>,
  extra: Partial<DescribeResponse> = {},
): DescribeResponse {
  return {
    collection,
    capabilities,
    schema: SchemaDocSchema.parse({ version: "v1", fields }),
    view: ViewConfigSchema.parse(view),
    filterable: { fields: [] },
    source_kind: "postgres_jsonb",
    ...extra,
  };
}

/** The whole data view of `collection` on the stub kit, at `?tab=<tab>`. */
function mountView(
  collection: string,
  tab: string,
  describes: Record<string, DescribeResponse>,
  rows: Record<string, Row[]>,
) {
  window.history.replaceState(null, "", `/?tab=${tab}`);
  const mock = mockUdcFetch({
    describe: (body) => ({ ok: describes[String(body.collection)] }),
    list: (body) => ({ ok: listOf(rows[String(body.collection)] ?? []) }),
  });
  const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
  render(
    <UdcI18nProvider>
      <UdcProvider client={client} kit={stubKit} renderers={RENDERERS}>
        <QueryClientProvider client={createUdcQueryClient()}>
          <stubKit.TooltipProvider>
            <stubKit.Toaster>
              <UdcDataView collection={collection} />
            </stubKit.Toaster>
          </stubKit.TooltipProvider>
        </QueryClientProvider>
      </UdcProvider>
    </UdcI18nProvider>,
  );
  return mock;
}

/** The view drew with the stub kit and nothing of Radix ended up in the page. */
function expectStubOnly() {
  expect(document.querySelectorAll('[data-kit="stub"]').length).toBeGreaterThan(0);
  expect(
    document.querySelector("[data-radix-collection-item], [data-radix-popper-content-wrapper]"),
  ).toBeNull();
}

/** The stable `udc-*` classes a host's plain CSS targets are on the page. */
function expectStable(...classes: string[]) {
  for (const c of classes) expect(document.querySelector(`.${c}`), c).not.toBeNull();
}

afterEach(() => window.history.replaceState(null, "", "/"));

const companyFields = {
  name: { type: "string" },
  city: { type: "string" },
  employees: { type: "integer" },
  lat: { type: "decimal" },
  lng: { type: "decimal" },
};
const companyRows = [
  row("c1", 1, { name: "Acme", city: "Beograd", employees: 120, lat: 44.8, lng: 20.46 }),
  row("c2", 1, { name: "Globex", city: "Niš", employees: 40, lat: 43.32, lng: 21.9 }),
];
const companies = (view: Record<string, unknown>, extra: Partial<DescribeResponse> = {}) => ({
  companies: describeOf("companies", companyFields, view, extra),
});

describe("the stub kit: every renderer family draws without the default kit", () => {
  it("table: the tab switch, a filter chip, the filter builder and the column menu's dialog", async () => {
    const user = userEvent.setup();
    mountView(
      "companies",
      "table",
      companies(
        {
          available_renderers: ["table", "cards"],
          columns: [{ field: "name" }, { field: "city" }],
          search: { fields: ["name"] },
          filters: [{ field: "city", kind: "select", options: ["Beograd", "Niš"] }],
        },
        {
          capabilities: { ...capabilities, schema_edit: true },
          filterable: {
            fields: [
              {
                field: "name",
                type: "string",
                ops: ["contains", "eq"],
                default_op: "contains",
                widget: "text",
              },
            ],
          },
        },
      ),
      { companies: companyRows },
    );
    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expect(screen.getAllByTestId("row")).toHaveLength(2);
    expect(screen.getByTestId("search-input")).toHaveAttribute("data-stub", "Input");
    expect(screen.getByTestId("tab-switch")).toHaveAttribute("data-stub", "Segmented");
    expectStable(
      "udc-data-view",
      "udc-toolbar",
      "udc-search",
      "udc-filter-chip",
      "udc-table",
      "udc-row",
      "udc-cell",
    );

    // A chip's popover, with the stub checkbox inside.
    await user.click(screen.getByTestId("chip-city"));
    const panel = screen.getByTestId("chip-panel-city");
    expect(panel).toHaveAttribute("data-stub", "PopoverContent");
    expect(within(panel).getAllByRole("checkbox")).toHaveLength(2);

    // The filter builder's popover: field and op are stub selects.
    await user.click(screen.getByTestId("fb-open"));
    expect(screen.getByTestId("fb-panel")).toHaveAttribute("data-stub", "PopoverContent");

    // The column menu (a dropdown) opens the field form (a dialog).
    await user.click(screen.getByTestId("col-menu-name"));
    expect(screen.getByTestId("col-menu")).toHaveAttribute("data-stub", "DropdownMenuContent");
    await user.click(screen.getByTestId("col-menu-edit"));
    const form = await screen.findByTestId("field-form");
    expect(form).toHaveAttribute("data-stub", "DialogContent");
    expect(form).toHaveClass("udc-schema-editor");
    await user.click(within(form).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByTestId("field-form")).toBeNull());
    expectStubOnly();
  });

  it("cards", async () => {
    mountView(
      "companies",
      "cards",
      companies({ available_renderers: ["table", "cards"], card_options: { title_field: "name" } }),
      { companies: companyRows },
    );
    expect(await screen.findAllByTestId("card")).toHaveLength(2);
    expectStable("udc-card");
    expectStubOnly();
  });

  it("the pager of the paged mode carries udc-pager", async () => {
    mountView(
      "companies",
      "table&mode=pages",
      companies({ available_renderers: ["table"], columns: [{ field: "name" }] }),
      { companies: companyRows },
    );
    expect(await screen.findByText("Acme")).toBeInTheDocument();
    expectStable("udc-pager");
    expectStubOnly();
  });

  it("kanban: the board switcher is a stub select", async () => {
    const opts = {
      bucket_collection: "buckets",
      bucket_filter_field: "board_id",
      ticket_board_field: "board_id",
      ticket_bucket_field: "bucket_id",
      card: { title_field: "title" },
    };
    mountView(
      "tickets",
      "kanban",
      {
        tickets: describeOf(
          "tickets",
          {
            board_id: { type: "relation", ref: "boards", label_field: "name" },
            bucket_id: { type: "relation", ref: "buckets" },
            order: { type: "integer" },
            title: { type: "string" },
          },
          { available_renderers: ["kanban", "table"], kanban_options: opts },
        ),
        boards: describeOf("boards", { name: { type: "string" } }, {}),
        buckets: describeOf("buckets", { name: { type: "string" } }, {}),
      },
      {
        boards: [row("B", 1, { name: "Board" })],
        buckets: [row("b1", 1, { name: "Todo", order: 100, board_id: "B" })],
        tickets: [row("t1", 1, { title: "Ship it", bucket_id: "b1", board_id: "B", order: 100 })],
      },
    );
    expect(await screen.findByText("Ship it")).toBeInTheDocument();
    expectStable("udc-kanban", "udc-kanban-column", "udc-kanban-card");
    expect(screen.getByTestId("kanban-column-menu")).toHaveAttribute(
      "data-stub",
      "DropdownMenuTrigger",
    );
    expectStubOnly();
  });

  it("calendar", async () => {
    mountView(
      "appointments",
      "calendar",
      {
        appointments: describeOf(
          "appointments",
          { title: { type: "string" }, start: { type: "datetime" }, end: { type: "datetime" } },
          {
            available_renderers: ["calendar", "table"],
            calendar_options: { start_field: "start", end_field: "end", title_field: "title" },
          },
        ),
      },
      { appointments: [] },
    );
    expect(await screen.findByTestId("calendar")).toBeInTheDocument();
    expectStable("udc-calendar");
    expect(screen.getByTestId("cal-today")).toHaveAttribute("data-stub", "Button");
    expect(screen.getByTestId("cal-presets")).toHaveAttribute("data-stub", "Segmented");
    expectStubOnly();
  });

  it("tree", async () => {
    mountView(
      "comments",
      "tree",
      {
        comments: describeOf(
          "comments",
          { parent_id: { type: "string" }, body: { type: "text" }, depth: { type: "integer" } },
          {
            available_renderers: ["tree"],
            tree_options: { label_field: "body", expand: { default_depth: 99, key: "stub" } },
          },
        ),
      },
      {
        comments: [
          row("a", 1, { parent_id: null, body: "root", depth: 0 }),
          row("a1", 1, { parent_id: "a", body: "child", depth: 1 }),
        ],
      },
    );
    expect(await screen.findByText("child")).toBeInTheDocument();
    expect(screen.getAllByTestId("tree-node")).toHaveLength(2);
    expectStable("udc-tree", "udc-tree-node");
    expectStubOnly();
  });

  it("map", async () => {
    mountView(
      "companies",
      "map",
      companies({
        available_renderers: ["map", "table"],
        map_options: {
          lat_field: "lat",
          lng_field: "lng",
          regions: [
            { id: "serbia", label: "Serbia", center: [44.2, 20.9], zoom: 7 },
            { id: "south", label: "South", center: [43.15, 21.9], zoom: 8 },
          ],
        },
      }),
      { companies: companyRows },
    );
    expect(await screen.findByTestId("map")).toBeInTheDocument();
    expectStable("udc-map");
    expect(screen.getByTestId("map-regions")).toHaveAttribute("data-stub", "Segmented");
    expectStubOnly();
  });

  it("chart: the window presets are a stub segmented control", async () => {
    mountView(
      "metrics",
      "chart",
      {
        metrics: describeOf(
          "metrics",
          { ts: { type: "datetime" }, cpu: { type: "decimal" } },
          {
            available_renderers: ["chart", "table"],
            chart_options: { x_field: "ts", series: [{ field: "cpu" }], window: { field: "ts" } },
          },
        ),
      },
      {
        metrics: [
          row("m1", 1, { ts: "2026-10-27T10:00:00Z", cpu: 61 }),
          row("m2", 1, { ts: "2026-10-27T10:15:00Z", cpu: 64 }),
        ],
      },
    );
    expect(await screen.findByTestId("chart-tab")).toBeInTheDocument();
    expectStable("udc-chart");
    expect(await screen.findByTestId("chart-presets")).toHaveAttribute("data-stub", "Segmented");
    expectStubOnly();
  });
});
