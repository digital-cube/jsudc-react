import { type DescribeResponse, SchemaDocSchema, ViewConfigSchema } from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, renderHook, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RENDERERS } from "../src/all";
import { UdcDataView } from "../src/data-view/UdcDataView";
import { useKanbanBoard } from "../src/kanban/useKanbanBoard";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import {
  createMemoryUrlStateAdapter,
  prefixUrlStateAdapter,
  UdcUrlStateProvider,
  useUrlSearchParams,
  windowLocationAdapter,
} from "../src/url-state";
import { at, listFilters, mountWith } from "./embedFixture";
import { listOf, mockUdcFetch, row } from "./fetchMock";

afterEach(() => at("/"));

const search = () => new URLSearchParams(window.location.search);

describe("prefixUrlStateAdapter", () => {
  it("reads only its own keys, without the prefix", () => {
    const inner = createMemoryUrlStateAdapter("q=host&a.q=mine&a.sort=x:asc&ab=1");
    const a = prefixUrlStateAdapter(inner, "a.");
    expect(a.get().toString()).toBe("q=mine&sort=x%3Aasc");
  });

  it("writes only its own keys and leaves every other parameter as it was", () => {
    const inner = createMemoryUrlStateAdapter("q=host&a.q=old&b.q=other");
    const a = prefixUrlStateAdapter(inner, "a.");
    a.set(new URLSearchParams({ q: "new", p: "2" }), { replace: true });
    const now = inner.get();
    expect(now.get("q")).toBe("host");
    expect(now.get("b.q")).toBe("other");
    expect(now.get("a.q")).toBe("new");
    expect(now.get("a.p")).toBe("2");
    a.set(new URLSearchParams());
    expect(inner.get().toString()).toBe("q=host&b.q=other");
  });

  it("passes replace through and subscribes to the inner adapter", () => {
    const inner = createMemoryUrlStateAdapter();
    const set = vi.spyOn(inner, "set");
    const a = prefixUrlStateAdapter(inner, "a.");
    const listener = vi.fn();
    const off = a.subscribe(listener);
    a.set(new URLSearchParams({ q: "x" }), { replace: true });
    expect(set).toHaveBeenCalledWith(expect.any(URLSearchParams), { replace: true });
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    inner.set(new URLSearchParams());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("nests: a prefix over a prefix", () => {
    const inner = createMemoryUrlStateAdapter("x.y.q=1&x.q=2");
    expect(prefixUrlStateAdapter(prefixUrlStateAdapter(inner, "x."), "y.").get().get("q")).toBe(
      "1",
    );
  });

  it("refuses an empty prefix, which would claim every parameter", () => {
    expect(() => prefixUrlStateAdapter(windowLocationAdapter, "")).toThrow(/prefix/);
  });
});

describe("createMemoryUrlStateAdapter", () => {
  it("keeps the query string in memory: the address bar is not touched", () => {
    at("/inbox?q=host");
    const memory = createMemoryUrlStateAdapter({ q: "seed" });
    const listener = vi.fn();
    memory.subscribe(listener);
    expect(memory.get().get("q")).toBe("seed");
    memory.set(new URLSearchParams({ q: "typed" }));
    expect(memory.get().get("q")).toBe("typed");
    expect(memory.history).toEqual(["q=typed"]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(window.location.pathname + window.location.search).toBe("/inbox?q=host");
  });

  it("each call is a store of its own; get returns a copy", () => {
    const a = createMemoryUrlStateAdapter();
    const b = createMemoryUrlStateAdapter();
    a.set(new URLSearchParams({ q: "a" }));
    a.get().set("q", "mutated");
    expect(a.get().get("q")).toBe("a");
    expect(b.get().toString()).toBe("");
  });

  it("drives useUrlSearchParams through the provider", () => {
    const memory = createMemoryUrlStateAdapter();
    const { result } = renderHook(() => useUrlSearchParams(), {
      wrapper: ({ children }) => (
        <UdcUrlStateProvider adapter={memory}>{children}</UdcUrlStateProvider>
      ),
    });
    act(() => result.current[1](new URLSearchParams({ sort: "a:asc" })));
    expect(result.current[0].get("sort")).toBe("a:asc");
    expect(window.location.search).toBe("");
  });
});

/** Type into a view's search box and wait for the debounce to report it. */
async function typeSearch(view: HTMLElement, text: string) {
  fireEvent.change(within(view).getByTestId("search-input"), { target: { value: text } });
  await new Promise((r) => setTimeout(r, 350));
}

const views = () => screen.getAllByTestId("data-view");

describe("two prefixed views on one page", () => {
  it("keep separate search, sort and page; a host ?q= is neither read nor removed", async () => {
    at("/mail?q=host&other=1");
    mountWith(
      <>
        <UdcDataView collection="messages" urlPrefix="a." />
        <UdcDataView collection="messages" urlPrefix="b." />
      </>,
    );
    await waitFor(() => expect(screen.getAllByTestId("udc-table")).toHaveLength(2));
    const [a, b] = views() as [HTMLElement, HTMLElement];
    // The host's q is not the views' search.
    expect(within(a).getByTestId("search-input")).toHaveValue("");
    expect(within(b).getByTestId("search-input")).toHaveValue("");

    await act(() => typeSearch(a, "inv"));
    await waitFor(() => expect(search().get("a.q")).toBe("inv"));
    fireEvent.click(within(b).getByTestId("sort-subject"));
    await waitFor(() => expect(search().get("b.sort")).toBe("subject:asc"));
    fireEvent.click(within(a).getByTestId("pager-page-2"));
    await waitFor(() => expect(search().get("a.p")).toBe("2"));

    const now = search();
    expect(now.get("q")).toBe("host");
    expect(now.get("other")).toBe("1");
    expect(now.get("b.q")).toBeNull();
    expect(now.get("a.sort")).toBeNull();
    expect(now.get("b.p")).toBeNull();
    expect(now.get("sort")).toBeNull();
    expect(window.location.pathname).toBe("/mail");
    expect(within(b).getByTestId("search-input")).toHaveValue("");
    expect(within(b).getByTestId("sort-subject").closest("th")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(within(a).getByTestId("sort-subject").closest("th")).not.toHaveAttribute("aria-sort");
  });

  it("each view's requests follow its own state", async () => {
    at("/?a.q=inv");
    const { calls } = mountWith(
      <>
        <UdcDataView collection="messages" urlPrefix="a." />
        <UdcDataView collection="messages" urlPrefix="b." />
      </>,
    );
    await waitFor(() => expect(screen.getAllByTestId("udc-table")).toHaveLength(2));
    const filters = listFilters(calls);
    expect(filters).toContainEqual({
      field: "subject",
      op: "contains",
      value: "inv",
      case_insensitive: true,
    });
    expect(filters).toContainEqual(undefined);
  });

  it("an unprefixed view next to a prefixed one keeps today's names", async () => {
    at("/");
    mountWith(
      <>
        <UdcDataView collection="messages" />
        <UdcDataView collection="messages" urlPrefix="b." />
      </>,
    );
    await waitFor(() => expect(screen.getAllByTestId("udc-table")).toHaveLength(2));
    const [plain] = views() as [HTMLElement];
    fireEvent.click(within(plain).getByTestId("sort-subject"));
    await waitFor(() => expect(search().get("sort")).toBe("subject:asc"));
    expect(search().get("b.sort")).toBeNull();
  });
});

describe('urlState="memory"', () => {
  it("leaves the address bar untouched; the view still filters", async () => {
    at("/inbox?q=host");
    const { calls } = mountWith(<UdcDataView collection="messages" urlState="memory" />);
    await screen.findByTestId("udc-table");
    const [view] = views() as [HTMLElement];
    await act(() => typeSearch(view, "inv"));
    fireEvent.click(within(view).getByTestId("sort-subject"));
    await waitFor(() =>
      expect(listFilters(calls)).toContainEqual({
        field: "subject",
        op: "contains",
        value: "inv",
        case_insensitive: true,
      }),
    );
    expect(window.location.pathname + window.location.search).toBe("/inbox?q=host");
    expect(within(view).getByTestId("search-input")).toHaveValue("inv");
  });

  it("two memory views do not share state", async () => {
    mountWith(
      <>
        <UdcDataView collection="messages" urlState="memory" />
        <UdcDataView collection="messages" urlState="memory" />
      </>,
    );
    await waitFor(() => expect(screen.getAllByTestId("udc-table")).toHaveLength(2));
    const [a, b] = views() as [HTMLElement, HTMLElement];
    await act(() => typeSearch(a, "inv"));
    await waitFor(() => expect(within(a).getByTestId("search-input")).toHaveValue("inv"));
    expect(within(b).getByTestId("search-input")).toHaveValue("");
  });

  it("an adapter of the host's, with a prefix on top", async () => {
    const store = createMemoryUrlStateAdapter("q=host");
    mountWith(<UdcDataView collection="messages" urlState={store} urlPrefix="list." />);
    await screen.findByTestId("udc-table");
    const [view] = views() as [HTMLElement];
    fireEvent.click(within(view).getByTestId("sort-subject"));
    await waitFor(() => expect(store.get().get("list.sort")).toBe("subject:asc"));
    expect(store.get().get("q")).toBe("host");
    expect(window.location.search).toBe("");
  });
});

describe("the renderers' own parameters are prefixed too", () => {
  const describeTickets: DescribeResponse = {
    collection: "tickets",
    capabilities: {
      mutate: true,
      subscribe: false,
      total_count: true,
      schema_edit: false,
      config_edit: false,
      reindex: true,
      tree_reparent: false,
      source_yaml: false,
      supported_filter_ops: [],
    },
    schema: SchemaDocSchema.parse({
      version: "v1",
      fields: {
        board_id: { type: "relation", ref: "boards", label_field: "name" },
        bucket_id: { type: "relation", ref: "buckets" },
        title: { type: "string" },
      },
    }),
    view: ViewConfigSchema.parse({
      available_renderers: ["kanban", "table"],
      default_renderer: "kanban",
      kanban_options: {
        bucket_collection: "buckets",
        bucket_filter_field: "board_id",
        ticket_board_field: "board_id",
        ticket_bucket_field: "bucket_id",
        card: { title_field: "title" },
      },
    }),
    filterable: { fields: [] },
    source_kind: "postgres_jsonb",
  };

  it("the kanban's board: read from and written to k.board, the host's ?board= left alone", async () => {
    at("/?board=HOST&k.board=B2");
    const mock = mockUdcFetch({
      describe: () => ({
        ok: {
          ...describeTickets,
          collection: "boards",
          schema: SchemaDocSchema.parse({ version: "v1", fields: { name: { type: "string" } } }),
          view: ViewConfigSchema.parse({}),
        },
      }),
      list: () => ({
        ok: listOf([row("B1", 1, { name: "Roadmap" }), row("B2", 1, { name: "Release" })]),
      }),
    });
    const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
    const qc = createUdcQueryClient();
    const adapter = prefixUrlStateAdapter(windowLocationAdapter, "k.");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <UdcProvider client={client} renderers={RENDERERS}>
        <QueryClientProvider client={qc}>
          <UdcUrlStateProvider adapter={adapter}>{children}</UdcUrlStateProvider>
        </QueryClientProvider>
      </UdcProvider>
    );
    const { result } = renderHook(() => useKanbanBoard(describeTickets), { wrapper });
    await waitFor(() => expect(result.current.boardId).toBe("B2"));
    act(() => result.current.setBoard("B1"));
    await waitFor(() => expect(search().get("k.board")).toBe("B1"));
    expect(search().get("board")).toBe("HOST");
  });
});
