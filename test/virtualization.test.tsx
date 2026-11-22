// Long lists (0.5.0, R5): the table's infinite mode mounts only the rows near the viewport,
// spacers stand for the rest, and what works on rows (keys, selection, editors, the sentinel,
// aria) keeps working on rows that come and go.
import { type DescribeResponse, type Row, ViewConfigSchema } from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { RENDERERS } from "../src/all";
import { UdcDataView } from "../src/data-view/UdcDataView";
import {
  bodySlices,
  keepRange,
  resolveVirtualization,
  virtualizationApplies,
  visibleRange,
  withOverscan,
} from "../src/headless";
import { UdcI18nProvider } from "../src/i18n/i18n";
import { TableRenderer, type TableRendererProps } from "../src/table";
import type { UdcCollectionResult } from "../src/udc/hooks";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { Toaster, TooltipProvider } from "../src/ui-kit/ui";
import { describeMessages } from "./embedFixture";
import { listOf, mockUdcFetch, row } from "./fetchMock";

/** The scrolled element's height in this DOM (jsdom lays nothing out). */
const VIEWPORT = 400;
const ROW_HEIGHT = 40;
const OVERSCAN = 10;
/** The most rows a window of VIEWPORT may mount: what shows, the overscan on both sides, a kept row or two. */
const MAX_MOUNTED = Math.ceil(VIEWPORT / ROW_HEIGHT) + 2 * OVERSCAN + 2;

const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.testid === "table-scroll" ? VIEWPORT : 0;
    },
  });
});
afterAll(() => {
  if (original) Object.defineProperty(HTMLElement.prototype, "clientHeight", original);
});

const rowsOf = (n: number, from = 0): Row[] =>
  Array.from({ length: n }, (_, i) =>
    row(`m${from + i}`, 1, { subject: `Subject ${from + i}`, from: "ana", folder: "inbox" }),
  );

function describeWith(view: Record<string, unknown> = {}, mutate = false): DescribeResponse {
  return {
    ...describeMessages,
    capabilities: { ...describeMessages.capabilities, mutate },
    view: ViewConfigSchema.parse({
      available_renderers: ["table"],
      columns: [{ field: "subject" }, { field: "from" }],
      search: { fields: ["subject"] },
      pagination: "infinite",
      page_size_default: 50,
      ...view,
    }),
  };
}

function dataOf(rows: Row[], extra: Partial<UdcCollectionResult> = {}): UdcCollectionResult {
  return {
    rows,
    total: rows.length,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    fetchedAt: null,
    stale: false,
    ...extra,
  };
}

function wrapperFor(list: (body: Record<string, unknown>) => Row[] = () => []) {
  const describe = describeWith();
  const mock = mockUdcFetch({
    describe: () => ({ ok: describe }),
    list: (body) => ({ ok: listOf(list(body)) }),
    update: (body) => ({ ok: { row: { __meta: { id: body.id, version: 2 } } } }),
  });
  const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
  const qc = createUdcQueryClient();
  return ({ children }: { children: ReactNode }) => (
    <UdcI18nProvider>
      <UdcProvider client={client} renderers={RENDERERS}>
        <QueryClientProvider client={qc}>
          <TooltipProvider>
            <Toaster>{children}</Toaster>
          </TooltipProvider>
        </QueryClientProvider>
      </UdcProvider>
    </UdcI18nProvider>
  );
}

type Overrides = Partial<TableRendererProps>;

function tableProps(rows: Row[], o: Overrides = {}): TableRendererProps {
  return {
    collection: "messages",
    describe: describeWith(),
    data: dataOf(rows),
    mode: "infinite",
    page: 1,
    limit: 50,
    onPage: vi.fn(),
    sort: [],
    onSort: vi.fn(),
    filtered: false,
    onClearFilters: vi.fn(),
    resetKey: "",
    ...o,
  };
}

function mountTable(rows: Row[], o: Overrides = {}) {
  const wrapper = wrapperFor();
  const utils = render(<TableRenderer {...tableProps(rows, o)} />, { wrapper });
  const rerender = (next: Overrides) =>
    utils.rerender(<TableRenderer {...tableProps(rows, { ...o, ...next })} />);
  return { ...utils, rerender };
}

const scroller = () => screen.getByTestId("table-scroll");
const mountedIds = () => screen.queryAllByTestId("row").map((r) => r.getAttribute("data-row-id"));
const rowEl = (id: string) => document.querySelector<HTMLElement>(`tr[data-row-id="${id}"]`);
function scrollTo(top: number) {
  const el = scroller();
  el.scrollTop = top;
  fireEvent.scroll(el);
}
/** The body's height as drawn: every spacer plus every mounted row. */
function bodyHeight() {
  const spacers = screen.queryAllByTestId("row-spacer");
  const rows = screen.queryAllByTestId("row");
  return (
    spacers.reduce((sum, s) => sum + Number.parseFloat(s.style.height), 0) +
    rows.reduce((sum, r) => sum + Number.parseFloat(r.style.height), 0)
  );
}

describe("the window's arithmetic", () => {
  it("resolves the options against their defaults", () => {
    expect(resolveVirtualization(undefined)).toEqual({
      enabled: "auto",
      threshold: 200,
      overscan: 10,
    });
    expect(resolveVirtualization(true)).toEqual({ enabled: true, threshold: 200, overscan: 10 });
    expect(resolveVirtualization({ threshold: 50, overscan: -1 })).toEqual({
      enabled: "auto",
      threshold: 50,
      overscan: 10,
    });
  });

  it("applies in infinite mode only, past the threshold unless forced", () => {
    expect(virtualizationApplies(undefined, "infinite", 200)).toBe(false);
    expect(virtualizationApplies(undefined, "infinite", 201)).toBe(true);
    expect(virtualizationApplies(undefined, "pages", 5000)).toBe(false);
    expect(virtualizationApplies(true, "infinite", 3)).toBe(true);
    expect(virtualizationApplies(true, "pages", 5000)).toBe(false);
    expect(virtualizationApplies(false, "infinite", 5000)).toBe(false);
    expect(virtualizationApplies({ threshold: 10 }, "infinite", 11)).toBe(true);
  });

  it("finds the visible rows and widens them by the overscan", () => {
    expect(visibleRange(0, 400, 36, 40, 5000)).toEqual({ start: 0, end: 10 });
    expect(visibleRange(4000, 400, 36, 40, 5000)).toEqual({ start: 100, end: 110 });
    expect(visibleRange(199_640, 400, 0, 40, 5000)).toEqual({ start: 4991, end: 5000 });
    expect(withOverscan({ start: 100, end: 110 }, 10, 5000)).toEqual({ start: 90, end: 120 });
    expect(withOverscan({ start: 2, end: 12 }, 10, 15)).toEqual({ start: 0, end: 15 });
  });

  it("keeps the window while the visible rows stay well inside it", () => {
    expect(keepRange({ start: 90, end: 120 }, { start: 96, end: 106 }, 10, 5000)).toBe(true);
    expect(keepRange({ start: 90, end: 120 }, { start: 108, end: 118 }, 10, 5000)).toBe(false);
    expect(keepRange({ start: 0, end: 20 }, { start: 0, end: 10 }, 10, 5000)).toBe(true);
  });

  it("puts kept rows where they belong, with spacers between", () => {
    expect(bodySlices(100, { start: 40, end: 50 }, [3, 45, 99])).toEqual([
      { kind: "gap", from: 0, rows: 3 },
      { kind: "rows", from: 3, to: 4 },
      { kind: "gap", from: 4, rows: 36 },
      { kind: "rows", from: 40, to: 50 },
      { kind: "gap", from: 50, rows: 49 },
      { kind: "rows", from: 99, to: 100 },
    ]);
    expect(bodySlices(10, { start: 0, end: 10 }, [])).toEqual([{ kind: "rows", from: 0, to: 10 }]);
  });
});

describe("5 000 loaded rows", () => {
  const FIVE_K = rowsOf(5000);

  it("mount no more than the window plus the overscan", () => {
    mountTable(FIVE_K);
    const ids = mountedIds();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(MAX_MOUNTED);
    expect(ids[0]).toBe("m0");
  });

  it("change which rows are mounted as the list scrolls", () => {
    mountTable(FIVE_K);
    scrollTo(2500 * ROW_HEIGHT);
    const ids = mountedIds();
    expect(ids.length).toBeLessThanOrEqual(MAX_MOUNTED);
    expect(ids).toContain("m2500");
    expect(ids).not.toContain("m0");
    expect(rowEl("m2500")?.getAttribute("aria-rowindex")).toBe("2501");
    scrollTo(0);
    expect(mountedIds()).toContain("m0");
    expect(mountedIds()).not.toContain("m2500");
  });

  it("take the scroll height of 5 000 rows", () => {
    mountTable(FIVE_K);
    expect(bodyHeight()).toBe(5000 * ROW_HEIGHT);
    scrollTo(1234 * ROW_HEIGHT);
    expect(bodyHeight()).toBe(5000 * ROW_HEIGHT);
  });

  it("are counted by aria-rowcount, the loaded count, whatever the total", () => {
    mountTable(FIVE_K, { data: dataOf(FIVE_K, { total: 120_000, hasNextPage: true }) });
    expect(screen.getByTestId("udc-table")).toHaveAttribute("aria-rowcount", "5000");
    expect(rowEl("m0")).toHaveAttribute("aria-rowindex", "1");
  });

  it("keep the scroll position through a refetch of the change feed", () => {
    const { rerender } = mountTable(FIVE_K);
    scrollTo(3000 * ROW_HEIGHT);
    const before = mountedIds();
    // The same rows, refetched: new objects, a new version on one of them.
    const refetched = FIVE_K.map((r) => ({ ...r, __meta: { ...r.__meta, version: 2 } }));
    rerender({ data: dataOf(refetched, { isFetching: true }) });
    rerender({ data: dataOf(refetched) });
    expect(scroller().scrollTop).toBe(3000 * ROW_HEIGHT);
    expect(mountedIds()).toEqual(before);
  });
});

describe("when it applies", () => {
  it("leaves a list at or under the threshold exactly as it was drawn without the feature", () => {
    const rows = rowsOf(200);
    const auto = mountTable(rows);
    const withAuto = auto.container.innerHTML;
    auto.unmount();
    const off = mountTable(rows, { virtualize: false });
    expect(off.container.innerHTML).toBe(withAuto);
    expect(screen.getAllByTestId("row")).toHaveLength(200);
    expect(screen.queryAllByTestId("row-spacer")).toHaveLength(0);
    expect(screen.getAllByTestId("row")[0]).not.toHaveAttribute("aria-rowindex");
  });

  it("is forced on below the threshold, with the overscan asked for", () => {
    mountTable(rowsOf(150), { virtualize: { enabled: true, overscan: 2 } });
    expect(mountedIds()).toHaveLength(Math.ceil(VIEWPORT / ROW_HEIGHT) + 2);
    expect(screen.getAllByTestId("row-spacer")).toHaveLength(1);
  });

  it("follows a threshold of the host's", () => {
    mountTable(rowsOf(150), { virtualize: { threshold: 100 } });
    expect(mountedIds().length).toBeLessThanOrEqual(MAX_MOUNTED);
  });

  it("is forced off above the threshold", () => {
    mountTable(rowsOf(600), { virtualize: false });
    expect(screen.getAllByTestId("row")).toHaveLength(600);
  });

  it("never applies in pages mode", () => {
    mountTable(rowsOf(600), { mode: "pages", virtualize: true });
    expect(screen.getAllByTestId("row")).toHaveLength(600);
    expect(screen.queryAllByTestId("row-spacer")).toHaveLength(0);
  });
});

describe("the keys across the window", () => {
  const FIVE_K = rowsOf(5000);

  it("ArrowDown from the last mounted row moves to the next one, mounts and focuses it", () => {
    mountTable(FIVE_K, { onRowActivate: vi.fn() });
    const ids = mountedIds();
    const last = ids[ids.length - 1] as string;
    const n = Number(last.slice(1));
    const next = `m${n + 1}`;
    expect(rowEl(next)).toBeNull();
    act(() => rowEl(last)?.focus());
    fireEvent.keyDown(rowEl(last) as HTMLElement, { key: "ArrowDown" });
    expect(rowEl(next)).not.toBeNull();
    expect(document.activeElement).toBe(rowEl(next));
    expect(rowEl(next)).toHaveAttribute("aria-selected", "true");
    // It scrolled in: its bottom edge is at the viewport's.
    expect(scroller().scrollTop).toBe((n + 2) * ROW_HEIGHT - VIEWPORT);
  });

  it("End goes to the last loaded row and Home back to the first", () => {
    mountTable(FIVE_K, { onRowActivate: vi.fn() });
    act(() => rowEl("m0")?.focus());
    fireEvent.keyDown(rowEl("m0") as HTMLElement, { key: "End" });
    expect(document.activeElement).toBe(rowEl("m4999"));
    expect(rowEl("m4999")).toHaveAttribute("aria-rowindex", "5000");
    expect(scroller().scrollTop).toBe(5000 * ROW_HEIGHT - VIEWPORT);
    expect(mountedIds().length).toBeLessThanOrEqual(MAX_MOUNTED);
    fireEvent.keyDown(rowEl("m4999") as HTMLElement, { key: "Home" });
    expect(document.activeElement).toBe(rowEl("m0"));
    expect(scroller().scrollTop).toBe(0);
  });

  it("the active row keeps the focus while it is scrolled away and back", () => {
    mountTable(FIVE_K, { onRowActivate: vi.fn() });
    act(() => rowEl("m3")?.focus());
    fireEvent.keyDown(rowEl("m3") as HTMLElement, { key: "ArrowDown" });
    const focused = rowEl("m4");
    expect(document.activeElement).toBe(focused);
    scrollTo(2000 * ROW_HEIGHT);
    expect(mountedIds()).toContain("m2000");
    expect(rowEl("m4")).toBe(focused);
    expect(document.activeElement).toBe(focused);
    scrollTo(0);
    expect(document.activeElement).toBe(focused);
  });

  it("ArrowDown on the last loaded row asks for the next page", () => {
    const fetchNextPage = vi.fn();
    mountTable(FIVE_K, {
      onRowActivate: vi.fn(),
      data: dataOf(FIVE_K, { hasNextPage: true, total: 10_000, fetchNextPage }),
    });
    act(() => rowEl("m0")?.focus());
    fireEvent.keyDown(rowEl("m0") as HTMLElement, { key: "End" });
    fireEvent.keyDown(rowEl("m4999") as HTMLElement, { key: "ArrowDown" });
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});

describe("the sentinel", () => {
  const io: { cb: IntersectionObserverCallback; target: Element | null }[] = [];
  const saved = globalThis.IntersectionObserver;
  beforeAll(() => {
    globalThis.IntersectionObserver = class {
      constructor(cb: IntersectionObserverCallback) {
        io.push({ cb, target: null });
      }
      observe(el: Element) {
        const last = io[io.length - 1];
        if (last) last.target = el;
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  });
  afterAll(() => {
    globalThis.IntersectionObserver = saved;
  });

  it("still loads the next page when the end of the loaded rows comes into view", () => {
    const FIVE_K = rowsOf(5000);
    const fetchNextPage = vi.fn();
    const { rerender } = mountTable(FIVE_K, {
      data: dataOf(FIVE_K, { hasNextPage: true, total: 5050, fetchNextPage }),
    });
    scrollTo(5000 * ROW_HEIGHT - VIEWPORT);
    const sentinel = screen.getByTestId("infinite-sentinel");
    const observer = [...io].reverse().find((o) => o.target === sentinel);
    expect(observer).toBeDefined();
    act(() => {
      observer?.cb(
        [{ isIntersecting: true, target: sentinel } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    // The page arrives: its rows join the list, the scroll position stays.
    const more = [...FIVE_K, ...rowsOf(50, 5000)];
    rerender({ data: dataOf(more, { total: 5050 }) });
    expect(screen.getByTestId("udc-table")).toHaveAttribute("aria-rowcount", "5050");
    expect(bodyHeight()).toBe(5050 * ROW_HEIGHT);
    expect(scroller().scrollTop).toBe(5000 * ROW_HEIGHT - VIEWPORT);
  });
});

describe("editors and selection across the window", () => {
  it("an open editor survives a scroll away and back", () => {
    const rows = rowsOf(5000);
    mountTable(rows, {
      describe: describeWith(
        { columns: [{ field: "subject", editable: true }, { field: "from" }] },
        true,
      ),
    });
    const cell = rowEl("m5")?.querySelector<HTMLElement>(
      '[data-testid="cell-subject"]',
    ) as HTMLElement;
    fireEvent.doubleClick(cell);
    const input = rowEl("m5")?.querySelector("input") as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: "half typed" } });
    scrollTo(3000 * ROW_HEIGHT);
    expect(mountedIds()).toContain("m3000");
    expect(rowEl("m5")?.querySelector("input")).toBe(input);
    scrollTo(0);
    expect(rowEl("m5")?.querySelector("input")).toBe(input);
    expect(input.value).toBe("half typed");
  });

  it("a shift-range of checkboxes spanning unmounted rows selects every one of them", async () => {
    const rows = rowsOf(5000);
    const wrapper = wrapperFor(() => rows);
    render(<UdcDataView collection="messages" pagingMode="infinite" selectable />, { wrapper });
    await waitFor(() => expect(rowEl("m0")).not.toBeNull());
    expect(mountedIds().length).toBeLessThanOrEqual(MAX_MOUNTED);
    const box = (id: string) =>
      rowEl(id)?.querySelector<HTMLElement>('[data-testid="select-row"]') as HTMLElement;
    fireEvent.click(box("m2"));
    scrollTo(3000 * ROW_HEIGHT);
    fireEvent.click(box("m3000"), { shiftKey: true });
    // Rows that were never mounted in between are selected: look at a few.
    for (const at of [1500, 2999]) {
      scrollTo(at * ROW_HEIGHT);
      expect(rowEl(`m${at}`)).toHaveAttribute("data-selected", "true");
    }
    scrollTo(3001 * ROW_HEIGHT);
    expect(rowEl("m3001")).not.toHaveAttribute("data-selected");
    scrollTo(0);
    expect(rowEl("m1")).not.toHaveAttribute("data-selected");
    expect(rowEl("m2")).toHaveAttribute("data-selected", "true");
    expect(screen.getByText(/2[,.\s]?999/)).toBeInTheDocument();
  });

  it("a view forced to window through UdcDataView windows a short list too", async () => {
    const rows = rowsOf(120);
    const wrapper = wrapperFor(() => rows);
    render(
      <UdcDataView
        collection="messages"
        pagingMode="infinite"
        virtualize={{ enabled: true, overscan: 4 }}
      />,
      { wrapper },
    );
    await waitFor(() => expect(rowEl("m0")).not.toBeNull());
    expect(mountedIds()).toHaveLength(Math.ceil(VIEWPORT / ROW_HEIGHT) + 4);
    expect(screen.getByTestId("udc-table")).toHaveAttribute("aria-rowcount", "120");
  });
});
