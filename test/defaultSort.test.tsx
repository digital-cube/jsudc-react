// A default sort (0.6.0): the view's `default_sort`, or the host's `defaultSort` prop, is the
// list's `sort` while the URL state has none. It is shown in the headers, never written into the
// URL, and steps aside while a search answered by the source is typed.
import {
  type DescribeResponse,
  type SortKey,
  type ViewConfig,
  ViewConfigSchema,
} from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { RENDERERS } from "../src/all";
import { UdcDataView, type UdcDataViewProps } from "../src/data-view/UdcDataView";
import { resolveSort, sortParamFor, viewDefaultSort } from "../src/data-view/useDataViewState";
import { UdcI18nProvider } from "../src/i18n/i18n";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { Toaster, TooltipProvider } from "../src/ui-kit/ui";
import { createMemoryUrlStateAdapter } from "../src/url-state/adapters";
import { describeMessages } from "./embedFixture";
import { type Call, listOf, mockUdcFetch, row } from "./fetchMock";

const NEWEST: SortKey[] = [{ field: "subject", dir: "desc" }];

describe("viewDefaultSort", () => {
  it("reads the view's default_sort; none, or an ill-formed one, is []", () => {
    const view = ViewConfigSchema.parse({ default_sort: NEWEST });
    expect(viewDefaultSort(view)).toEqual(NEWEST);
    expect(viewDefaultSort(ViewConfigSchema.parse({}))).toEqual([]);
    expect(viewDefaultSort(undefined)).toEqual([]);
    // Core 0.6.0's ViewConfigSchema refuses it at parse; a view built without the parse reads as none.
    const illFormed = { default_sort: [{ field: "a", dir: "up" }] };
    expect(() => ViewConfigSchema.parse(illFormed)).toThrow();
    expect(viewDefaultSort({ ...ViewConfigSchema.parse({}), ...illFormed } as ViewConfig)).toEqual(
      [],
    );
  });
});

describe("resolveSort", () => {
  it("a sort in the URL wins; an empty one is the user's 'no sort'", () => {
    expect(resolveSort("from:asc", NEWEST, false)).toEqual([{ field: "from", dir: "asc" }]);
    expect(resolveSort("", NEWEST, false)).toEqual([]);
  });

  it("no sort in the URL: the default, unless it steps aside for a source search", () => {
    expect(resolveSort(null, NEWEST, false)).toEqual(NEWEST);
    expect(resolveSort(null, NEWEST, true)).toEqual([]);
    expect(resolveSort(null, [], false)).toEqual([]);
  });
});

describe("sortParamFor", () => {
  it("without a default: as before (none removes the parameter)", () => {
    expect(sortParamFor([{ field: "a", dir: "asc" }], [], false)).toBe("a:asc");
    expect(sortParamFor([], [], false)).toBeNull();
  });

  it("with a default: the default itself is not written, 'no sort' is written empty", () => {
    expect(sortParamFor(NEWEST, NEWEST, false)).toBeNull();
    expect(sortParamFor([], NEWEST, false)).toBe("");
    expect(sortParamFor([{ field: "from", dir: "asc" }], NEWEST, false)).toBe("from:asc");
  });

  it("while the default steps aside: what the user picks is written, none removes it", () => {
    expect(sortParamFor(NEWEST, NEWEST, true)).toBe("subject:desc");
    expect(sortParamFor([], NEWEST, true)).toBeNull();
  });
});

const ROWS = [
  row("m1", 1, { subject: "Alpha", from: "ana" }),
  row("m2", 1, { subject: "Bravo", from: "bob" }),
];

function describeWith(opts: { source?: boolean; defaultSort?: SortKey[] }): DescribeResponse {
  return {
    ...describeMessages,
    capabilities: {
      ...describeMessages.capabilities,
      ...(opts.source ? { search: "source" as const } : {}),
    },
    view: ViewConfigSchema.parse({
      available_renderers: ["table"],
      columns: [{ field: "subject" }, { field: "from" }],
      search: { fields: ["subject"] },
      pagination: "pages",
      ...(opts.defaultSort ? { default_sort: opts.defaultSort } : {}),
    }),
  };
}

function mount(describe: DescribeResponse, props: Partial<UdcDataViewProps> = {}, initial = "") {
  const mock = mockUdcFetch({
    describe: () => ({ ok: describe }),
    list: () => ({ ok: listOf(ROWS) }),
  });
  const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
  const qc = createUdcQueryClient();
  const store = createMemoryUrlStateAdapter(initial);
  const wrapper = ({ children }: { children: ReactNode }) => (
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
  render(<UdcDataView collection="messages" urlState={store} {...props} />, { wrapper });
  return { calls: mock.calls as Call[], store };
}

const lists = (calls: Call[]) => calls.filter((c) => c.action === "list").map((c) => c.body);
const lastList = (calls: Call[]) => lists(calls).at(-1) as Record<string, unknown>;
const header = (field: string) => screen.getByTestId(`sort-${field}`).closest("th");
const type = (text: string) =>
  fireEvent.change(screen.getByTestId("search-input"), { target: { value: text } });

describe("UdcDataView with a default sort", () => {
  it("the view's default_sort goes out with the very first list, and stays out of the URL", async () => {
    const { calls, store } = mount(describeWith({ defaultSort: NEWEST }));
    await screen.findByText("Alpha");
    // Not one list without it: the first page is already in the default order.
    expect(lists(calls).every((b) => JSON.stringify(b.sort) === JSON.stringify(NEWEST))).toBe(true);
    expect(store.get().get("sort")).toBeNull();
    expect(header("subject")).toHaveAttribute("aria-sort", "descending");
  });

  it("a sort in the URL state wins over the default", async () => {
    const { calls } = mount(describeWith({ defaultSort: NEWEST }), {}, "sort=from:asc");
    await screen.findByText("Alpha");
    expect(lists(calls).map((b) => b.sort)).toEqual(
      lists(calls).map(() => [{ field: "from", dir: "asc" }]),
    );
    expect(header("from")).toHaveAttribute("aria-sort", "ascending");
    expect(header("subject")).not.toHaveAttribute("aria-sort");
  });

  it("a header click cycles from the default: desc → none (written as sort=) → asc", async () => {
    const { calls, store } = mount(describeWith({ defaultSort: NEWEST }));
    await screen.findByText("Alpha");
    fireEvent.click(screen.getByTestId("sort-subject"));
    await waitFor(() => expect(store.get().get("sort")).toBe(""));
    await waitFor(() => expect(lastList(calls).sort).toEqual([]));
    expect(header("subject")).not.toHaveAttribute("aria-sort");
    fireEvent.click(screen.getByTestId("sort-subject"));
    await waitFor(() => expect(store.get().get("sort")).toBe("subject:asc"));
    // Back to the default itself: the parameter goes away again.
    fireEvent.click(screen.getByTestId("sort-subject"));
    await waitFor(() => expect(store.get().get("sort")).toBeNull());
    expect(header("subject")).toHaveAttribute("aria-sort", "descending");
  });

  it("steps aside while a source search is typed, and comes back when it is cleared", async () => {
    const { calls, store } = mount(describeWith({ source: true, defaultSort: NEWEST }));
    await screen.findByText("Alpha");
    type("alp");
    await waitFor(() => expect(lastList(calls).search).toBe("alp"));
    expect(lastList(calls).sort).toEqual([]);
    expect(header("subject")).not.toHaveAttribute("aria-sort");
    type("");
    await waitFor(() => expect(lastList(calls)).not.toHaveProperty("search"));
    expect(lastList(calls).sort).toEqual(NEWEST);
    expect(store.get().get("sort")).toBeNull();
  });

  it("a sort the user picks is kept through a source search", async () => {
    const { calls } = mount(
      describeWith({ source: true, defaultSort: NEWEST }),
      {},
      "sort=from:asc",
    );
    await screen.findByText("Alpha");
    type("alp");
    await waitFor(() => expect(lastList(calls).search).toBe("alp"));
    expect(lastList(calls).sort).toEqual([{ field: "from", dir: "asc" }]);
  });

  it("does not step aside for a search composed into the filter (no rank order to keep)", async () => {
    const { calls } = mount(describeWith({ defaultSort: NEWEST }));
    await screen.findByText("Alpha");
    type("alp");
    await waitFor(() => expect(lastList(calls).filter).toBeDefined());
    expect(lastList(calls).sort).toEqual(NEWEST);
  });

  it("the defaultSort prop replaces the view's", async () => {
    const byProp = mount(describeWith({ defaultSort: NEWEST }), {
      defaultSort: [{ field: "from", dir: "asc" }],
    });
    await screen.findAllByText("Alpha");
    expect(lists(byProp.calls)[0]?.sort).toEqual([{ field: "from", dir: "asc" }]);
  });

  it("defaultSort={[]} sends no sort even when the view has one", async () => {
    const { calls } = mount(describeWith({ defaultSort: NEWEST }), { defaultSort: [] });
    await screen.findByText("Alpha");
    expect(lists(calls).every((b) => JSON.stringify(b.sort) === "[]")).toBe(true);
  });

  it("the defaultSort prop on a view without default_sort", async () => {
    const { calls, store } = mount(describeWith({}), { defaultSort: NEWEST });
    await screen.findByText("Alpha");
    expect(lists(calls)[0]?.sort).toEqual(NEWEST);
    expect(store.get().get("sort")).toBeNull();
  });

  it("a view without either: exactly as before", async () => {
    const { calls } = mount(describeWith({}));
    await screen.findByText("Alpha");
    expect(lists(calls).every((b) => JSON.stringify(b.sort) === "[]")).toBe(true);
  });
});
