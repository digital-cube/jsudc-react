// Custom cells (0.4.0, R3): a host registers cell components by name; a column's `render`
// resolves from the host's registry first, then from the built-in kinds.
import { type DescribeResponse, type Row, SchemaDocSchema, ViewConfigSchema } from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RENDERERS } from "../src/all";
import {
  type CellProps,
  type CellRegistry,
  cellComponent,
  createCellRegistry,
  UdcCellsProvider,
  useCellRegistry,
} from "../src/cells/registry";
import { UdcDataView } from "../src/data-view/UdcDataView";
import * as headless from "../src/headless";
import { UdcI18nProvider } from "../src/i18n/i18n";
import * as root from "../src/index";
import { CellValue } from "../src/table/cells";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { Toaster, TooltipProvider } from "../src/ui-kit/ui";
import { listOf, mockUdcFetch, row } from "./fetchMock";

const describeMail = (view: Record<string, unknown> = {}): DescribeResponse => ({
  collection: "messages",
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
    fields: {
      subject: { type: "string" },
      from: { type: "string" },
      label: { type: "string" },
      unread: { type: "bool" },
    },
  }),
  view: ViewConfigSchema.parse({
    available_renderers: ["table", "cards"],
    columns: [
      { field: "subject" },
      { field: "from", render: "sender", render_options: { size: 20 } },
      { field: "label", render: "badge" },
      { field: "unread", render: "nobody_registered_this" },
    ],
    card_options: { title_field: "subject", meta_fields: ["from"] },
    pagination: "pages",
    page_size_default: 10,
    ...view,
  }),
  filterable: { fields: [] },
  source_kind: "postgres_jsonb",
});

const ROWS: Row[] = [
  row("m1", 1, { subject: "Hello", from: "ana@x.rs", label: "work", unread: true }),
  row("m2", 1, { subject: "Invoice", from: "bob@x.rs", label: "home", unread: false }),
];

function mount(ui: ReactNode, opts: { cells?: CellRegistry; describe?: DescribeResponse } = {}) {
  const describe = opts.describe ?? describeMail();
  const mock = mockUdcFetch({
    describe: () => ({ ok: describe }),
    list: () => ({ ok: listOf(ROWS) }),
  });
  const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
  const qc = createUdcQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UdcI18nProvider>
      <UdcProvider
        client={client}
        renderers={RENDERERS}
        {...(opts.cells ? { cells: opts.cells } : {})}
      >
        <QueryClientProvider client={qc}>
          <TooltipProvider>
            <Toaster>{children}</Toaster>
          </TooltipProvider>
        </QueryClientProvider>
      </UdcProvider>
    </UdcI18nProvider>
  );
  return render(ui, { wrapper });
}

const cellsOf = async (field: string) => {
  await screen.findAllByTestId("row");
  return screen.getAllByTestId(`cell-${field}`);
};

beforeEach(() => window.history.replaceState(null, "", "/c/messages"));

// The host's cell components of these tests.
const seen: CellProps[] = [];
function Sender(props: CellProps) {
  seen.push(props);
  return (
    <span data-testid="sender">
      {String(props.value)} · {String(props.row.subject)}
    </span>
  );
}
function Pill({ value, column }: CellProps) {
  return <em data-testid="host-badge">{`${String(value)}:${column.render}`}</em>;
}
const surfaces: string[] = [];
function CardSender({ value, row: r, surface }: CellProps) {
  surfaces.push(surface);
  return <span data-testid="card-sender">{`${String(value)}/${r.__meta.id}`}</span>;
}
/** A CellValue drawn the way the chart, map, calendar and kanban draw one: without `cells`. */
function BadgeProbe() {
  const cells = useCellRegistry();
  return (
    <>
      <span data-testid="has">{Object.keys(cells).join(",")}</span>
      <CellValue
        value="work"
        column={{ field: "label", render: "badge" }}
        def={{ type: "string" } as never}
        locale="en"
        intlLocale="en-US"
      />
    </>
  );
}
const A = () => null;
const B = () => null;
const C = () => null;
let probed: CellRegistry = {};
function RegistryProbe() {
  probed = useCellRegistry();
  return null;
}

describe("the cell registry", () => {
  it("a registered cell component draws its column and gets the row, column, field, collection", async () => {
    seen.length = 0;
    mount(<UdcDataView collection="messages" />, {
      cells: createCellRegistry({ name: "sender", component: Sender }),
    });
    const cells = await cellsOf("from");
    expect(within(cells[0] as HTMLElement).getByTestId("sender")).toHaveTextContent(
      "ana@x.rs · Hello",
    );
    expect(within(cells[1] as HTMLElement).getByTestId("sender")).toHaveTextContent(
      "bob@x.rs · Invoice",
    );
    const first = seen.find((p) => p.row.__meta.id === "m1") as CellProps;
    expect(first.value).toBe("ana@x.rs");
    expect(first.row).toMatchObject({ __meta: { id: "m1", version: 1 }, subject: "Hello" });
    expect(first.column).toMatchObject({
      field: "from",
      render: "sender",
      render_options: { size: 20 },
    });
    expect(first.def).toMatchObject({ type: "string" });
    expect(first.collection).toBe("messages");
    expect(first.surface).toBe("table");
    expect(first.editable).toBe(false);
    expect(typeof first.locale).toBe("string");
    expect(typeof first.intlLocale).toBe("string");
  });

  it("an unregistered name renders as before, and the built-in kinds stay without a registry", async () => {
    mount(<UdcDataView collection="messages" />, {
      cells: createCellRegistry({ name: "sender", component: () => <b>s</b> }),
    });
    // `nobody_registered_this` is not a kind: the field type's (bool) draws it, as in 0.3.
    const unread = await cellsOf("unread");
    expect(unread[0]?.querySelector('[data-bool="true"]')).not.toBeNull();
    expect(unread[1]?.querySelector('[data-bool="false"]')).not.toBeNull();
    // `badge` is still the built-in pill.
    const label = screen.getAllByTestId("cell-label");
    expect(within(label[0] as HTMLElement).getByTestId("badge")).toHaveTextContent("work");
  });

  it("a host replaces a built-in kind by registering its name", async () => {
    mount(<UdcDataView collection="messages" />, {
      cells: createCellRegistry({ name: "badge", component: Pill }),
    });
    const label = await cellsOf("label");
    expect(within(label[0] as HTMLElement).getByTestId("host-badge")).toHaveTextContent(
      "work:badge",
    );
    expect(within(label[0] as HTMLElement).queryByTestId("badge")).toBeNull();
  });

  it("UdcDataView cells adds to the provider's, its own names winning", async () => {
    const provided = createCellRegistry(
      { name: "sender", component: () => <i data-testid="provided-sender">p</i> },
      { name: "badge", component: () => <i data-testid="provided-badge">p</i> },
    );
    const own = createCellRegistry({
      name: "sender",
      component: ({ value }) => <i data-testid="own-sender">{String(value)}</i>,
    });
    mount(<UdcDataView collection="messages" cells={own} />, { cells: provided });
    const from = await cellsOf("from");
    expect(within(from[0] as HTMLElement).getByTestId("own-sender")).toHaveTextContent("ana@x.rs");
    expect(screen.queryByTestId("provided-sender")).toBeNull();
    expect(screen.getAllByTestId("provided-badge")).toHaveLength(2);
  });

  it("a per-view registry alone is enough (no provider registry)", async () => {
    mount(
      <UdcDataView
        collection="messages"
        cells={createCellRegistry({ name: "sender", component: () => <u data-testid="v">v</u> })}
      />,
    );
    await cellsOf("from");
    expect(screen.getAllByTestId("v")).toHaveLength(2);
  });

  it("the cards draw a meta field through the same registry", async () => {
    surfaces.length = 0;
    mount(<UdcDataView collection="messages" />, {
      cells: createCellRegistry({ name: "sender", component: CardSender }),
      describe: describeMail({
        available_renderers: ["cards"],
        default_renderer: "cards",
        columns: [{ field: "subject" }, { field: "from", render: "sender" }],
      }),
    });
    const metas = await screen.findAllByTestId("card-meta-from");
    expect(within(metas[0] as HTMLElement).getByTestId("card-sender")).toHaveTextContent(
      "ana@x.rs/m1",
    );
    expect(new Set(surfaces)).toEqual(new Set(["card"]));
  });

  it("CellValue without `cells` (the chart, map, calendar, kanban) keeps the built-in kinds", () => {
    const Host = vi.fn(() => <b data-testid="host">h</b>);
    render(
      <UdcCellsProvider cells={createCellRegistry({ name: "badge", component: Host })}>
        <BadgeProbe />
      </UdcCellsProvider>,
    );
    expect(screen.getByTestId("has")).toHaveTextContent("badge");
    expect(screen.getByTestId("badge")).toHaveTextContent("work");
    expect(Host).not.toHaveBeenCalled();
  });
});

describe("the registry functions", () => {
  it("a later definition replaces an earlier one; only own names resolve", () => {
    const reg = createCellRegistry({ name: "x", component: A }, { name: "x", component: B });
    expect(cellComponent(reg, "x")).toBe(B);
    expect(cellComponent(reg, "toString")).toBeUndefined();
    expect(cellComponent(reg, undefined)).toBeUndefined();
    expect(cellComponent(undefined, "x")).toBeUndefined();
    expect(Object.isFrozen(reg)).toBe(true);
  });

  it("nested providers add up, the inner names winning", () => {
    render(
      <UdcCellsProvider
        cells={createCellRegistry({ name: "a", component: A }, { name: "b", component: B })}
      >
        <UdcCellsProvider cells={createCellRegistry({ name: "b", component: C })}>
          <RegistryProbe />
        </UdcCellsProvider>
      </UdcCellsProvider>,
    );
    expect(probed).toEqual({ a: A, b: C });
  });

  it("is exported from the root and from @jsudc/react/headless", () => {
    for (const mod of [root, headless] as Record<string, unknown>[]) {
      expect(mod.createCellRegistry).toBe(createCellRegistry);
      expect(typeof mod.UdcCellsProvider).toBe("function");
      expect(typeof mod.useCellRegistry).toBe("function");
      expect(typeof mod.useRowActivation).toBe("function");
    }
  });
});
