// Search answered by the source (0.5.0, S6): with `capabilities.search: "source"` the search
// box travels as `ListRequest.search` and is not composed into the filter (the paged list,
// renderers that load their own rows, the query keys); without it every request is exactly
// today's. No sort indicator in relevance order; a new search clears the selection, and
// "select all that match" is not offered while a source search is active.
import { type DescribeResponse, type Row, ViewConfigSchema } from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { RENDERERS } from "../src/all";
import { UdcDataView, type UdcDataViewProps } from "../src/data-view/UdcDataView";
import { UdcI18nProvider } from "../src/i18n/i18n";
import { createRendererRegistry } from "../src/renderers/registry";
import type { RendererProps } from "../src/renderers/types";
import { fetchAllRows, searchPart, useUdcAllRows, useUdcCollection } from "../src/udc/hooks";
import { udcKeys } from "../src/udc/keys";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { Toaster, TooltipProvider } from "../src/ui-kit/ui";
import { describeMessages } from "./embedFixture";
import { type Call, listOf, mockUdcFetch, row } from "./fetchMock";

const m = (id: string, subject: string) => row(id, 1, { subject, from: "ana", folder: "inbox" });
const SEVEN = [
  m("m1", "Alpha"),
  m("m2", "Bravo"),
  m("m3", "Charlie"),
  m("m4", "Delta"),
  m("m5", "Echo"),
  m("m6", "Foxtrot"),
  m("m7", "Golf"),
];

function describeWith(opts: { source: boolean; view?: Record<string, unknown> }): DescribeResponse {
  return {
    ...describeMessages,
    capabilities: {
      ...describeMessages.capabilities,
      mutate: true,
      ...(opts.source ? { search: "source" as const } : {}),
    },
    view: ViewConfigSchema.parse({
      available_renderers: ["table", "cards"],
      columns: [{ field: "subject" }, { field: "folder" }],
      card_options: { title_field: "subject" },
      search: { fields: ["subject", "from"] },
      filters: [{ field: "folder", kind: "select" }],
      pagination: "pages",
      page_size_default: 3,
      ...opts.view,
    }),
  };
}

function mount(
  describe: DescribeResponse,
  props: Partial<UdcDataViewProps> = {},
  renderers: typeof RENDERERS = RENDERERS,
) {
  const mock = mockUdcFetch({
    describe: () => ({ ok: describe }),
    list: (body) => {
      const page = (body.page ?? {}) as { limit?: number; offset?: number };
      const offset = page.offset ?? 0;
      const limit = page.limit ?? 50;
      // The "source" answers a search with the rows whose subject has the text.
      const text = typeof body.search === "string" ? body.search.toLowerCase() : "";
      const hits = SEVEN.filter((r) => String(r.subject).toLowerCase().includes(text));
      return { ok: { ...listOf(hits.slice(offset, offset + limit)), total: hits.length } };
    },
  });
  const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
  const qc = createUdcQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UdcI18nProvider>
      <UdcProvider client={client} renderers={renderers}>
        <QueryClientProvider client={qc}>
          <TooltipProvider>
            <Toaster>{children}</Toaster>
          </TooltipProvider>
        </QueryClientProvider>
      </UdcProvider>
    </UdcI18nProvider>
  );
  const utils = render(<UdcDataView collection="messages" urlState="memory" {...props} />, {
    wrapper,
  });
  return { ...utils, calls: mock.calls as Call[], qc };
}

const lists = (calls: Call[]) => calls.filter((c) => c.action === "list").map((c) => c.body);
const lastList = (calls: Call[]) => lists(calls).at(-1) as Record<string, unknown>;
const type = (text: string) =>
  fireEvent.change(screen.getByTestId("search-input"), { target: { value: text } });
const rowEl = (id: string) =>
  screen.getAllByTestId("row").find((r) => r.getAttribute("data-row-id") === id) as HTMLElement;
const checkbox = (id: string) => within(rowEl(id)).getByTestId("select-row") as HTMLInputElement;

describe("the paged list", () => {
  it("with the capability: the text as `search`, no `contains` in the filter", async () => {
    const { calls, qc } = mount(describeWith({ source: true }));
    await screen.findByText("Alpha");
    expect(lastList(calls)).not.toHaveProperty("search");
    type("  golf ");
    await waitFor(() => expect(lastList(calls).search).toBe("golf"));
    const body = lastList(calls);
    expect(body).toEqual({
      collection: "messages",
      sort: [],
      search: "golf",
      page: { limit: 3, offset: 0 },
    });
    expect(JSON.stringify(lists(calls))).not.toContain("contains");
    await screen.findByText("Golf");
    // The query key carries the text, so each search is its own cache entry.
    const keys = qc
      .getQueryCache()
      .findAll({ queryKey: udcKeys.lists("messages") })
      .map((q) => q.queryKey[3] as Record<string, unknown>);
    expect(keys.some((k) => k.search === "golf")).toBe(true);
    expect(keys.every((k) => k.filter === undefined)).toBe(true);
  });

  it("without the capability: the request is exactly today's (`contains`, no `search`)", async () => {
    const { calls, qc } = mount(describeWith({ source: false }));
    await screen.findByText("Alpha");
    type("golf");
    await waitFor(() => expect(lastList(calls).filter).toBeDefined());
    expect(lastList(calls)).toEqual({
      collection: "messages",
      filter: {
        or: [
          { field: "subject", op: "contains", value: "golf", case_insensitive: true },
          { field: "from", op: "contains", value: "golf", case_insensitive: true },
        ],
      },
      sort: [],
      page: { limit: 3, offset: 0 },
    });
    expect(lists(calls).every((b) => !("search" in b))).toBe(true);
    const keys = qc
      .getQueryCache()
      .findAll({ queryKey: udcKeys.lists("messages") })
      .map((q) => q.queryKey[3] as Record<string, unknown>);
    expect(keys.every((k) => !("search" in k))).toBe(true);
  });

  it("the chips and the host's filter still go in `filter`, next to `search`", async () => {
    const { calls } = mount(describeWith({ source: true }), {
      filter: { field: "folder", op: "eq", value: "inbox" },
    });
    await screen.findByText("Alpha");
    type("a");
    await waitFor(() => expect(lastList(calls).search).toBe("a"));
    expect(lastList(calls).filter).toEqual({ field: "folder", op: "eq", value: "inbox" });
  });

  it("a cleared or blank box sends no `search`", async () => {
    const { calls } = mount(describeWith({ source: true }));
    await screen.findByText("Alpha");
    type("golf");
    await waitFor(() => expect(lastList(calls).search).toBe("golf"));
    type("   ");
    await waitFor(() => expect(lastList(calls)).not.toHaveProperty("search"));
    await screen.findByText("Alpha");
  });

  it("in infinite mode too (hook): `search` in every page and in the key", async () => {
    const mock = mockUdcFetch({ list: () => ({ ok: listOf([m("m7", "Golf")], 1) }) });
    const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
    const qc = createUdcQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <UdcProvider client={client} renderers={RENDERERS}>
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      </UdcProvider>
    );
    const { result } = renderHook(
      () =>
        useUdcCollection({ collection: "c", mode: "infinite", pageLimit: 10, search: " golf " }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(mock.calls[0]?.body).toEqual({
      collection: "c",
      sort: [],
      search: "golf",
      page: { limit: 10 },
    });
    expect(
      qc.getQueryData(
        udcKeys.list("c", { filter: undefined, sort: [], limit: 10, mode: "infinite" }),
      ),
    ).toBeUndefined();
    expect(
      qc.getQueryData(
        udcKeys.list("c", {
          filter: undefined,
          sort: [],
          limit: 10,
          mode: "infinite",
          search: "golf",
        }),
      ),
    ).toBeDefined();
  });
});

const received: RendererProps[] = [];
function OwnRows(p: RendererProps) {
  received.push(p);
  const all = useUdcAllRows({
    collection: p.collection,
    filter: p.filter,
    search: p.listSearch,
    capabilities: p.describe.capabilities,
  });
  return <div data-testid="own-rows">{all.rows.length}</div>;
}
const registry = createRendererRegistry({
  name: "table",
  component: OwnRows,
  icon: () => null,
  labelKey: "TAB_TABLE",
  paging: false,
  editMode: false,
} as never);

describe("renderers that load their own rows", () => {
  it("get `listSearch` and a filter without the search; their list carries `search`", async () => {
    received.length = 0;
    const { calls } = mount(describeWith({ source: true }), {}, registry);
    await waitFor(() => expect(screen.getByTestId("own-rows")).toHaveTextContent("7"));
    expect(received.at(-1)?.listSearch).toBeUndefined();
    type("golf");
    await waitFor(() => expect(screen.getByTestId("own-rows")).toHaveTextContent("1"));
    const last = received.at(-1) as RendererProps;
    expect(last.listSearch).toBe("golf");
    expect(last.search).toBe("golf");
    expect(last.filter).toBeUndefined();
    expect(last.baseFilter).toBeUndefined();
    expect(last.filtered).toBe(true);
    expect(lastList(calls)).toMatchObject({ collection: "messages", search: "golf" });
    expect(JSON.stringify(lists(calls))).not.toContain("contains");
  });

  it("without the capability: no `listSearch`, the search composed as before", async () => {
    received.length = 0;
    const { calls } = mount(describeWith({ source: false }), {}, registry);
    await waitFor(() => expect(screen.getByTestId("own-rows")).toHaveTextContent("7"));
    type("golf");
    await waitFor(() => expect(JSON.stringify(lastList(calls))).toContain("contains"));
    const last = received.at(-1) as RendererProps;
    expect("listSearch" in last).toBe(false);
    expect(JSON.stringify(last.filter)).toContain('"contains"');
    expect(lists(calls).every((b) => !("search" in b))).toBe(true);
  });

  it("fetchAllRows sends `search` on every page, and nothing for a blank one", async () => {
    const mock = mockUdcFetch({
      list: (body) => {
        const page = body.page as { limit: number; offset?: number };
        const start = page.offset ?? 0;
        return { ok: listOf(SEVEN.slice(start, start + page.limit), SEVEN.length) };
      },
    });
    const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
    await fetchAllRows(client, {
      collection: "c",
      max: 10,
      pageLimit: 4,
      cursor: false,
      search: "x",
    });
    expect(mock.calls.map((c) => c.body.search)).toEqual(["x", "x"]);
    mock.calls.length = 0;
    await fetchAllRows(client, {
      collection: "c",
      max: 10,
      pageLimit: 10,
      cursor: false,
      search: " ",
    });
    expect(mock.calls[0]?.body).not.toHaveProperty("search");
    expect(searchPart(undefined)).toEqual({});
    expect(searchPart("  a b ")).toEqual({ search: "a b" });
  });
});

describe("a built-in renderer that loads its own rows (map)", () => {
  it("sends the text as `search` with its list", async () => {
    const { calls } = mount(
      describeWith({
        source: true,
        view: {
          available_renderers: ["map"],
          default_renderer: "map",
          map_options: { lat_field: "lat", lng_field: "lng" },
        },
      }),
    );
    await waitFor(() => expect(lists(calls).length).toBeGreaterThan(0));
    type("golf");
    await waitFor(() => expect(lastList(calls).search).toBe("golf"));
    expect(JSON.stringify(lists(calls))).not.toContain("contains");
  });
});

describe("sort in relevance order", () => {
  it("with a search and no sort, no column shows a sort; a chosen sort is sent with the search", async () => {
    const { calls } = mount(describeWith({ source: true }));
    await screen.findByText("Alpha");
    type("a");
    await waitFor(() => expect(lastList(calls).search).toBe("a"));
    expect(document.querySelectorAll("[aria-sort]")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("sort-subject"));
    await waitFor(() => expect(lastList(calls).sort).toEqual([{ field: "subject", dir: "asc" }]));
    expect(lastList(calls).search).toBe("a");
    expect(screen.getByTestId("th-subject")).toHaveAttribute("aria-sort", "ascending");
  });
});

describe("the selection under a source search", () => {
  const bulk = { view: { bulk_actions: [{ kind: "archive" }] } };

  it("a changed search text clears it, as a changed filter does", async () => {
    mount(describeWith({ source: true, ...bulk }));
    await screen.findByText("Alpha");
    fireEvent.click(checkbox("m1"));
    expect(screen.getByTestId("bulk-count")).toHaveTextContent("1 selected");
    type("a");
    await waitFor(() => expect(screen.queryByTestId("bulk-bar")).toBeNull());
    await screen.findByText("Alpha");
    fireEvent.click(checkbox("m1"));
    expect(screen.getByTestId("bulk-count")).toHaveTextContent("1 selected");
    type("al");
    await waitFor(() => expect(screen.queryByTestId("bulk-bar")).toBeNull());
  });

  it("'select all that match' is not offered while it searches, with a hint why", async () => {
    const mounted = mount(describeWith({ source: true, ...bulk }));
    await screen.findByText("Alpha");
    // No search: offered as before.
    fireEvent.click(screen.getByTestId("select-page"));
    expect(screen.getByTestId("select-all-matching")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("bulk-clear"));
    // "a" matches Alpha, Bravo, Charlie, Delta, Foxtrot: more than the page of 3.
    const { calls } = mounted;
    type("a");
    await waitFor(() => expect(lastList(calls).search).toBe("a"));
    await waitFor(() => expect(screen.getByTestId("select-page")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("select-page"));
    expect(screen.getByTestId("bulk-count")).toHaveTextContent("3 selected");
    expect(screen.queryByTestId("select-all-matching")).toBeNull();
    expect(screen.getByTestId("select-all-matching-off")).toHaveTextContent(
      "Only the loaded rows can be selected while searching",
    );
  });

  it("without the capability a search still offers it (as in the earlier ticket)", async () => {
    mount(describeWith({ source: false, ...bulk }));
    await screen.findByText("Alpha");
    type("a");
    await waitFor(() => expect(screen.queryByText("Golf")).toBeNull());
    fireEvent.click(screen.getByTestId("select-page"));
    expect(screen.queryByTestId("select-all-matching-off")).toBeNull();
  });
});

// Keep the row type used in this file honest.
const _rows: Row[] = SEVEN;
void _rows;
