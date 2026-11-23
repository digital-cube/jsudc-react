// Column sizing against the table's pane (0.5.2): `width: fill` takes the pane's free width
// (`grow`, `min_width`), `hide_below` drops a column on a narrow pane. The keys are read loosely,
// so the table works with `@jsudc/core` ^0.5.0, whose schema does not know them.
import { type ColumnConfig, type DescribeResponse, type Row, ViewConfigSchema } from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RENDERERS } from "../src/all";
import { useRowSelection } from "../src/headless";
import { UdcI18nProvider } from "../src/i18n/i18n";
import { TableRenderer, type TableRendererProps } from "../src/table";
import { hiddenAtWidth, isFillWidth, layoutColumnWidths } from "../src/table/columnLayout";
import type { UdcCollectionResult } from "../src/udc/hooks";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { Toaster, TooltipProvider } from "../src/ui-kit/ui";
import { describeMessages } from "./embedFixture";
import { listOf, mockUdcFetch, row } from "./fetchMock";

const opts = (paneWidth: number | null, reserved = 0) => ({
  paneWidth,
  reserved,
  defaultWidth: 160,
});

describe("layoutColumnWidths", () => {
  it("fixed columns only: their width, else the default, whatever the pane", () => {
    const cols = [
      { id: "a", config: { width: 210 } },
      { id: "b", config: {} },
    ];
    expect(layoutColumnWidths(cols, opts(null))).toEqual({ a: 210, b: 160 });
    expect(layoutColumnWidths(cols, opts(2000))).toEqual({ a: 210, b: 160 });
  });

  it("a fill column takes what the pane has left after the fixed columns and the reserved", () => {
    const cols = [
      { id: "from", config: { width: 210 } },
      { id: "subject", config: { width: "fill", min_width: 240 } },
      { id: "date", config: { width: 84 } },
    ];
    expect(layoutColumnWidths(cols, opts(1000, 40)).subject).toBe(1000 - 40 - 210 - 84);
    // Never below its floor: the table then scrolls sideways.
    expect(layoutColumnWidths(cols, opts(420)).subject).toBe(240);
    // Not measured yet: the floor; no min_width: the view's default width.
    expect(layoutColumnWidths(cols, opts(null)).subject).toBe(240);
    expect(layoutColumnWidths([{ id: "s", config: { width: "fill" } }], opts(null)).s).toBe(160);
  });

  it("several fill columns share by grow, rounded down", () => {
    const cols = [
      { id: "a", config: { width: "fill", grow: 2 } },
      { id: "b", config: { width: "fill" } },
    ];
    expect(layoutColumnWidths(cols, opts(901))).toEqual({ a: 600, b: 300 });
  });

  it("a fill column pinned at its floor leaves the rest to the others", () => {
    const cols = [
      { id: "a", config: { width: "fill", min_width: 500 } },
      { id: "b", config: { width: "fill", min_width: 100 } },
      { id: "c", config: { width: "fill", min_width: 100 } },
    ];
    // An equal share would be 300; a is held at 500 and b, c split the other 400.
    expect(layoutColumnWidths(cols, opts(900))).toEqual({ a: 500, b: 200, c: 200 });
    // Too narrow for all of them: every one at its floor.
    expect(layoutColumnWidths(cols, opts(300))).toEqual({ a: 500, b: 100, c: 100 });
  });

  it("ignores ill-formed sizes: a column of a server that sent junk gets the default", () => {
    const cols = [
      { id: "a", config: { width: "auto" } },
      { id: "b", config: { width: -5 } },
      { id: "c", config: { width: "fill", grow: "x", min_width: 0 } },
    ];
    expect(layoutColumnWidths(cols, opts(1000))).toEqual({ a: 160, b: 160, c: 680 });
  });
});

describe("hiddenAtWidth and isFillWidth", () => {
  it("hides a column only on a measured pane narrower than hide_below", () => {
    expect(hiddenAtWidth({ hide_below: 600 }, 599)).toBe(true);
    expect(hiddenAtWidth({ hide_below: 600 }, 600)).toBe(false);
    expect(hiddenAtWidth({ hide_below: 600 }, null)).toBe(false);
    expect(hiddenAtWidth({ hide_below: 600 }, 0)).toBe(false);
    expect(hiddenAtWidth({}, 100)).toBe(false);
    expect(hiddenAtWidth({ hide_below: "600" }, 100)).toBe(false);
  });

  it("reads fill only from width", () => {
    expect(isFillWidth({ width: "fill" })).toBe(true);
    expect(isFillWidth({ width: 100 })).toBe(false);
    expect(isFillWidth({})).toBe(false);
  });
});

// The table in jsdom: the pane's clientWidth is set by the test, a resize is announced through a
// ResizeObserver the test drives.
let paneWidth = 0;
const observers = new Set<() => void>();
class TestResizeObserver {
  constructor(private cb: () => void) {}
  observe() {
    observers.add(this.cb);
  }
  unobserve() {}
  disconnect() {
    observers.delete(this.cb);
  }
}
const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
const originalRO = globalThis.ResizeObserver;
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.testid === "table-scroll" ? paneWidth : 0;
    },
  });
  globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
});
afterAll(() => {
  if (originalWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", originalWidth);
  globalThis.ResizeObserver = originalRO;
});
beforeEach(() => {
  paneWidth = 0;
  observers.clear();
});
const resizeTo = (w: number) =>
  act(() => {
    paneWidth = w;
    for (const cb of observers) cb();
  });

/** The webmail list of the ticket; the columns go in raw, as a newer server would send them. */
const MAIL_COLUMNS = [
  { field: "from", width: 210, hide_below: 560 },
  { field: "subject", width: "fill", min_width: 240 },
  { field: "folder", width: 84, align: "right" },
] as unknown as ColumnConfig[];

function describeWith(columns: ColumnConfig[]): DescribeResponse {
  const view = ViewConfigSchema.parse({ available_renderers: ["table"], pagination: "pages" });
  return { ...describeMessages, view: { ...view, columns } };
}

const ROWS: Row[] = [row("m1", 1, { subject: "Hello", from: "ana", folder: "inbox" })];

function data(): UdcCollectionResult {
  return {
    rows: ROWS,
    total: 1,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    fetchedAt: null,
    stale: false,
  };
}

function mount(columns: ColumnConfig[], extra: Partial<TableRendererProps> = {}) {
  const props: TableRendererProps = {
    collection: "messages",
    describe: describeWith(columns),
    data: data(),
    mode: "pages",
    page: 1,
    limit: 50,
    onPage: vi.fn(),
    sort: [],
    onSort: vi.fn(),
    filtered: false,
    onClearFilters: vi.fn(),
    resetKey: "",
    ...extra,
  };
  const mock = mockUdcFetch({
    describe: () => ({ ok: props.describe }),
    list: () => ({ ok: listOf(ROWS) }),
  });
  const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
  return render(
    <UdcI18nProvider>
      <UdcProvider client={client} renderers={RENDERERS}>
        <QueryClientProvider client={createUdcQueryClient()}>
          <TooltipProvider>
            <Toaster>
              <TableRenderer {...props} />
            </Toaster>
          </TooltipProvider>
        </QueryClientProvider>
      </UdcProvider>
    </UdcI18nProvider>,
  );
}

const widthOf = (field: string) => screen.getByTestId(`th-${field}`).style.width;
const tableWidth = () => screen.getByTestId("udc-table").style.width;

describe("the table lays its columns out to its pane", () => {
  it("a fill column takes the pane's free width and follows a resize", async () => {
    paneWidth = 1000;
    mount(MAIL_COLUMNS);
    expect(widthOf("from")).toBe("210px");
    expect(widthOf("subject")).toBe(`${1000 - 210 - 84}px`);
    expect(widthOf("folder")).toBe("84px");
    expect(tableWidth()).toBe("1000px");
    resizeTo(1400);
    expect(widthOf("subject")).toBe(`${1400 - 210 - 84}px`);
  });

  it("a narrow pane drops the hide_below column and gives its room to the fill column", () => {
    paneWidth = 420;
    mount(MAIL_COLUMNS);
    expect(screen.queryByTestId("th-from")).toBeNull();
    expect(screen.queryByTestId("cell-from")).toBeNull();
    expect(widthOf("subject")).toBe(`${420 - 84}px`);
    expect(screen.getByTestId("cell-folder")).toHaveTextContent("inbox");
    resizeTo(800);
    expect(screen.getByTestId("th-from")).toBeInTheDocument();
    expect(widthOf("subject")).toBe(`${800 - 210 - 84}px`);
  });

  it("the checkbox column is taken off the free width", () => {
    paneWidth = 1000;
    const { result } = renderHook(() => useRowSelection({ rows: ROWS, total: 1, resetKey: "" }));
    mount(MAIL_COLUMNS, { selection: result.current });
    expect(widthOf("subject")).toBe(`${1000 - 40 - 210 - 84}px`);
  });

  it("without fill or hide_below the widths are fixed, as before", () => {
    paneWidth = 1000;
    mount([{ field: "subject", width: 300 }, { field: "from" }] as ColumnConfig[]);
    expect(widthOf("subject")).toBe("300px");
    expect(widthOf("from")).toBe("160px");
    expect(tableWidth()).toBe("460px");
  });

  it("with no layout (clientWidth 0) nothing hides and a fill column is its floor", () => {
    mount(MAIL_COLUMNS);
    expect(screen.getByTestId("th-from")).toBeInTheDocument();
    expect(widthOf("subject")).toBe("240px");
  });
});
