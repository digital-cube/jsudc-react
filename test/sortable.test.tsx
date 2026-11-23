// Sortable fields (0.5.2): `describe.sortable` lists the fields the source sorts on. A header on
// any other field is plain text, not a sort button, and a sort naming one (from the URL, a default
// or an old link) never goes out, so one click cannot turn the list into "Could not load the data".
// A column's `sortable: false` takes the button off a field the source does sort.
import {
  type DescribeResponse,
  SchemaDocSchema,
  type SortKey,
  ViewConfigSchema,
} from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { RENDERERS } from "../src/all";
import { columnSortable, liveSort, sourceSortable } from "../src/data-view/liveView";
import { UdcDataView } from "../src/data-view/UdcDataView";
import { UdcI18nProvider } from "../src/i18n/i18n";
import { columnSortable as publicColumnSortable } from "../src/index";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { Toaster, TooltipProvider } from "../src/ui-kit/ui";
import { createMemoryUrlStateAdapter } from "../src/url-state/adapters";
import { describeMessages } from "./embedFixture";
import { type Call, listOf, mockUdcFetch, row } from "./fetchMock";

const schema = SchemaDocSchema.parse({
  version: "v1",
  fields: {
    subject: { type: "string" },
    uid: { type: "integer" },
    meta: { type: "json" },
    gone: { type: "string", deleted: true },
  },
});

describe("sourceSortable", () => {
  it("reads describe.sortable.fields; null when describe does not say or says it ill-formed", () => {
    const d = { ...describeMessages, sortable: { fields: ["uid"] } } as DescribeResponse;
    expect(sourceSortable(d)).toEqual(new Set(["uid"]));
    expect(
      sourceSortable({ ...describeMessages, sortable: { fields: [] } } as DescribeResponse),
    ).toEqual(new Set());
    expect(sourceSortable(describeMessages)).toBeNull();
    expect(sourceSortable(undefined)).toBeNull();
    expect(
      sourceSortable({ ...describeMessages, sortable: "uid" } as unknown as DescribeResponse),
    ).toBeNull();
  });
});

describe("columnSortable", () => {
  const def = (f: string) => schema.fields[f];
  it("a schema field the source sorts on, not json, not marked sortable: false", () => {
    expect(columnSortable({ field: "uid" }, def("uid"), null)).toBe(true);
    expect(columnSortable({ field: "uid" }, def("uid"), new Set(["uid"]))).toBe(true);
    expect(columnSortable({ field: "subject" }, def("subject"), new Set(["uid"]))).toBe(false);
    expect(columnSortable({ field: "meta" }, def("meta"), null)).toBe(false);
    expect(columnSortable({ field: "nope" }, undefined, null)).toBe(false);
    expect(columnSortable({ field: "uid", sortable: false } as never, def("uid"), null)).toBe(
      false,
    );
    expect(publicColumnSortable).toBe(columnSortable);
  });
});

describe("liveSort with the source's sortable fields", () => {
  it("drops keys on fields the source does not sort, as on gone fields", () => {
    const sort: SortKey[] = [
      { field: "subject", dir: "asc" },
      { field: "gone", dir: "asc" },
      { field: "uid", dir: "desc" },
    ];
    expect(liveSort(sort, schema, new Set(["uid"]))).toEqual([{ field: "uid", dir: "desc" }]);
    expect(liveSort(sort, schema, null)).toEqual([
      { field: "subject", dir: "asc" },
      { field: "uid", dir: "desc" },
    ]);
    expect(liveSort(sort, schema)).toEqual(liveSort(sort, schema, null));
  });
});

const ROWS = [
  row("m1", 1, { subject: "Alpha", from: "ana" }),
  row("m2", 1, { subject: "Bravo", from: "bob" }),
];

function describeWith(opts: {
  sortable?: string[];
  columns?: Record<string, unknown>[];
  defaultSort?: SortKey[];
}): DescribeResponse {
  return {
    ...describeMessages,
    view: ViewConfigSchema.parse({
      available_renderers: ["table"],
      columns: opts.columns ?? [{ field: "subject" }, { field: "from" }],
      pagination: "pages",
      ...(opts.defaultSort ? { default_sort: opts.defaultSort } : {}),
    }),
    ...(opts.sortable ? { sortable: { fields: opts.sortable } } : {}),
  } as DescribeResponse;
}

function mount(describe: DescribeResponse, initial = "") {
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
  render(<UdcDataView collection="messages" urlState={store} />, { wrapper });
  return { calls: mock.calls as Call[], store };
}

const lists = (calls: Call[]) => calls.filter((c) => c.action === "list").map((c) => c.body);

describe("UdcDataView with describe.sortable", () => {
  it("a field the source does not sort gets a plain header, the others a sort button", async () => {
    const { calls, store } = mount(describeWith({ sortable: ["from"] }));
    await screen.findByText("Alpha");
    expect(screen.queryByTestId("sort-subject")).toBeNull();
    expect(screen.getByTestId("th-subject")).toHaveTextContent(/subject/i);
    expect(screen.getByTestId("th-subject").querySelector("button")).toBeNull();
    fireEvent.click(screen.getByTestId("sort-from"));
    await waitFor(() => expect(store.get().get("sort")).toBe("from:asc"));
    await waitFor(() => expect(lists(calls).at(-1)?.sort).toEqual([{ field: "from", dir: "asc" }]));
  });

  it("a sort in the URL on a field the source does not sort is never sent", async () => {
    const { calls } = mount(describeWith({ sortable: ["from"] }), "sort=subject:asc");
    await screen.findByText("Alpha");
    expect(lists(calls).length).toBeGreaterThan(0);
    expect(lists(calls).every((b) => JSON.stringify(b.sort) === "[]")).toBe(true);
    expect(screen.getByTestId("th-subject")).not.toHaveAttribute("aria-sort");
  });

  it("only the keys the source sorts on are kept from a multi-key sort or a default", async () => {
    const multi = mount(describeWith({ sortable: ["from"] }), "sort=subject:asc,from:desc");
    await screen.findByText("Alpha");
    expect(lists(multi.calls).at(-1)?.sort).toEqual([{ field: "from", dir: "desc" }]);
  });

  it("a default_sort on a field the source does not sort is dropped", async () => {
    const { calls } = mount(
      describeWith({ sortable: ["from"], defaultSort: [{ field: "subject", dir: "desc" }] }),
    );
    await screen.findByText("Alpha");
    expect(lists(calls).every((b) => JSON.stringify(b.sort) === "[]")).toBe(true);
  });

  it("an empty sortable list: no header is a sort button", async () => {
    mount(describeWith({ sortable: [] }));
    await screen.findByText("Alpha");
    expect(screen.queryByTestId("sort-subject")).toBeNull();
    expect(screen.queryByTestId("sort-from")).toBeNull();
  });

  it("a server that does not say (no describe.sortable): every header sorts, as before", async () => {
    mount(describeWith({}));
    await screen.findByText("Alpha");
    expect(screen.getByTestId("sort-subject")).toBeInTheDocument();
    expect(screen.getByTestId("sort-from")).toBeInTheDocument();
  });

  it("a column marked sortable: false is plain even when the source sorts on it", async () => {
    mount(describeWith({ columns: [{ field: "subject", sortable: false }, { field: "from" }] }));
    await screen.findByText("Alpha");
    expect(screen.queryByTestId("sort-subject")).toBeNull();
    expect(screen.getByTestId("sort-from")).toBeInTheDocument();
  });
});
