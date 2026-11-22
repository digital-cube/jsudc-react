// The change feed in @jsudc/react (0.5.0, S5): UdcProvider changes, useUdcChanges, invalidation
// on events, polling as the fallback. `client.changes` is a fake stream the tests drive.
import {
  type ChangeEvent,
  type DescribeResponse,
  type Row,
  unauthenticatedError,
  ViewConfigSchema,
} from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { type ReactNode, useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { RENDERERS } from "../src/all";
import { UdcDataView } from "../src/data-view/UdcDataView";
import { useUdcChanges, useUdcCollection } from "../src/headless";
import { UdcI18nProvider } from "../src/i18n/i18n";
import { useUdcLookup } from "../src/lookup/useUdcLookup";
import type { UdcChangeFeedOptions } from "../src/udc/changeFeed";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { Toaster, TooltipProvider } from "../src/ui-kit/ui";
import { describeMessages } from "./embedFixture";
import { fakeChanges } from "./fakeStream";
import { type Call, listOf, mockUdcFetch, row } from "./fetchMock";

const m = (id: string, subject: string) => row(id, 1, { subject, from: "ana", folder: "inbox" });
const FOUR = [m("m1", "Alpha"), m("m2", "Bravo"), m("m3", "Charlie"), m("m4", "Delta")];
const FAST: UdcChangeFeedOptions = { debounceMs: 20, batchMs: 5 };

function describeWith(
  view: Record<string, unknown>,
  opts: { changes?: boolean; mutate?: boolean; collection?: string } = {},
): DescribeResponse {
  return {
    ...describeMessages,
    collection: opts.collection ?? "messages",
    capabilities: {
      ...describeMessages.capabilities,
      mutate: opts.mutate ?? false,
      ...(opts.changes === undefined ? {} : { changes: opts.changes }),
    },
    view: ViewConfigSchema.parse({
      available_renderers: ["table", "cards"],
      columns: [{ field: "subject" }, { field: "from" }],
      card_options: { title_field: "subject" },
      search: { fields: ["subject"] },
      pagination: "pages",
      page_size_default: 10,
      ...view,
    }),
  };
}

interface Server {
  /** By collection; one entry serves every collection. */
  describe: DescribeResponse | Record<string, DescribeResponse>;
  rows: Row[];
  /** Pages by cursor ("2" for the second page) of `pageSize` rows, instead of every row at once. */
  pageSize?: number;
}

function mount(
  ui: ReactNode,
  server: Server,
  opts: { changes?: boolean | UdcChangeFeedOptions; onUnauthenticated?: () => void } = {},
) {
  const mock = mockUdcFetch({
    describe: (body) => {
      const d = server.describe;
      const one = "collection" in d && typeof d.collection === "string";
      return {
        ok: one
          ? (d as DescribeResponse)
          : (d as Record<string, DescribeResponse>)[String(body.collection)],
      };
    },
    list: (body) => {
      const size = server.pageSize;
      if (!size) return { ok: listOf(server.rows) };
      const page = (body.page as { cursor?: string } | undefined)?.cursor;
      const from = page ? (Number(page) - 1) * size : 0;
      const next = from + size < server.rows.length ? String(from / size + 2) : null;
      return { ok: listOf(server.rows.slice(from, from + size), server.rows.length, next) };
    },
    update: (body) => ({ ok: { row: { __meta: { id: body.id, version: 2 } } } }),
  });
  const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
  const fake = fakeChanges(client);
  const spy = vi.spyOn(client, "changes");
  const qc = createUdcQueryClient(
    opts.onUnauthenticated ? { onUnauthenticated: opts.onUnauthenticated } : {},
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UdcI18nProvider>
      <UdcProvider
        client={client}
        renderers={RENDERERS}
        {...(opts.changes === undefined ? {} : { changes: opts.changes })}
      >
        <QueryClientProvider client={qc}>
          <TooltipProvider>
            <Toaster>{children}</Toaster>
          </TooltipProvider>
        </QueryClientProvider>
      </UdcProvider>
    </UdcI18nProvider>
  );
  const utils = render(ui, { wrapper });
  return { ...utils, calls: mock.calls as Call[], qc, fake, spy };
}

const isLookupBatch = (c: Call) => JSON.stringify(c.body.filter ?? null).includes('"op":"in"');
/** `list` calls of `collection`: the lists, or the lookup batches with `lookups`. */
const lists = (calls: Call[], collection = "messages", lookups = false) =>
  calls.filter(
    (c) => c.action === "list" && c.body.collection === collection && isLookupBatch(c) === lookups,
  ).length;
const sleep = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));
const ev = (collection: string, op: ChangeEvent["op"] = "update", ids?: string[]): ChangeEvent => ({
  collection,
  op,
  ...(ids ? { ids } : {}),
});
const rowEl = (id: string) =>
  screen.getAllByTestId("row").find((r) => r.getAttribute("data-row-id") === id) as HTMLElement;
const feedStatus = () => screen.queryByTestId("feed-status")?.getAttribute("data-status") ?? null;

/** A list of `collection` and a lookup batch into it, through the public hooks. */
function Pane({ collection = "messages" }: { collection?: string }) {
  const list = useUdcCollection({
    collection,
    mode: "pages",
    pageLimit: 10,
    capabilities: { changes: true },
  });
  const labels = useUdcLookup(collection, ["m1", "m2"]);
  return (
    <div data-testid={`pane-${collection}`}>
      {list.rows.length}/{labels.rows.size}
    </div>
  );
}

/** A host's badge: counts the inserted rows the feed reports. */
function Badge() {
  const [n, setN] = useState(0);
  const { status } = useUdcChanges("messages", (e) => {
    if (e.op === "insert") setN((x) => x + (e.ids?.length ?? 1));
  });
  return (
    <span data-testid="badge" data-status={status}>
      {n}
    </span>
  );
}

/** Two panes of messages and, on demand, one of people. */
function Panes() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(true);
  const [people, setPeople] = useState(false);
  return (
    <>
      {a ? <Pane /> : null}
      {b ? <Pane /> : null}
      {people ? <Pane collection="people" /> : null}
      <button type="button" onClick={() => setA(false)}>
        drop a
      </button>
      <button type="button" onClick={() => setB(false)}>
        drop b
      </button>
      <button type="button" onClick={() => setPeople(true)}>
        add people
      </button>
    </>
  );
}

describe("with the feed off", () => {
  it("nothing subscribes and refresh_interval_ms polls as before", async () => {
    const d = describeWith({ refresh_interval_ms: 40 }, { changes: true });
    const off = mount(<UdcDataView collection="messages" />, { describe: d, rows: FOUR });
    await screen.findAllByTestId("row");
    await waitFor(() => expect(lists(off.calls)).toBeGreaterThanOrEqual(3), { timeout: 2000 });
    expect(off.spy).not.toHaveBeenCalled();
    expect(feedStatus()).toBeNull();
    off.unmount();

    // `changes={false}` is the same.
    const no = mount(<Pane />, { describe: d, rows: FOUR }, { changes: false });
    await screen.findByText("4/4");
    await sleep(50);
    expect(no.spy).not.toHaveBeenCalled();
  });

  it("a collection that does not offer capabilities.changes is not subscribed, and polls", async () => {
    const d = describeWith({ refresh_interval_ms: 40 });
    const { calls, spy } = mount(
      <UdcDataView collection="messages" />,
      { describe: d, rows: FOUR },
      {
        changes: FAST,
      },
    );
    await screen.findAllByTestId("row");
    await waitFor(() => expect(lists(calls)).toBeGreaterThanOrEqual(3), { timeout: 2000 });
    expect(spy).not.toHaveBeenCalled();
    expect(feedStatus()).toBeNull();
  });
});

describe("events", () => {
  it("a burst of ten refetches the list and the lookups into it once; another collection's does nothing", async () => {
    const d = describeWith({}, { changes: true });
    const { calls, fake } = mount(<Pane />, { describe: d, rows: FOUR }, { changes: FAST });
    await screen.findByText("4/4");
    await waitFor(() => expect(fake.open).toHaveLength(1));
    expect(fake.last.collections).toEqual(["messages"]);
    fake.last.open();
    await sleep(80);
    const before = { list: lists(calls), lookups: lists(calls, "messages", true) };

    fake.last.emit(...Array.from({ length: 10 }, () => ev("people")));
    await sleep(80);
    expect(lists(calls)).toBe(before.list);
    expect(lists(calls, "messages", true)).toBe(before.lookups);

    fake.last.emit(...Array.from({ length: 10 }, (_, i) => ev("messages", "update", [`m${i}`])));
    await waitFor(() => expect(lists(calls)).toBe(before.list + 1));
    await waitFor(() => expect(lists(calls, "messages", true)).toBe(before.lookups + 1));
    await sleep(80);
    expect(lists(calls)).toBe(before.list + 1);
    expect(lists(calls, "messages", true)).toBe(before.lookups + 1);
  });

  it("a delete with ids takes the rows out of the cached lists at once", async () => {
    const d = describeWith({}, { changes: true });
    const { fake, calls } = mount(
      <UdcDataView collection="messages" />,
      { describe: d, rows: FOUR },
      {
        changes: { ...FAST, debounceMs: 10_000 },
      },
    );
    await screen.findAllByTestId("row");
    await waitFor(() => expect(fake.open).toHaveLength(1));
    fake.last.open();
    fake.last.emit(ev("messages", "delete", ["m2"]));
    // No refetch (the debounce is long, the server still answers m2): the row left the cache.
    const n = lists(calls);
    await waitFor(() =>
      expect(screen.getAllByTestId("row").map((r) => r.getAttribute("data-row-id"))).toEqual([
        "m1",
        "m3",
        "m4",
      ]),
    );
    expect(lists(calls)).toBe(n);
  });

  it("useUdcChanges hands each event to onEvent: a host's badge counter", async () => {
    const d = describeWith({}, { changes: true });
    const { fake } = mount(<Badge />, { describe: d, rows: FOUR }, { changes: FAST });
    await waitFor(() => expect(fake.open).toHaveLength(1));
    expect(screen.getByTestId("badge").dataset.status).toBe("connecting");
    fake.last.open();
    expect(screen.getByTestId("badge").dataset.status).toBe("live");
    fake.last.emit(
      ev("messages", "insert", ["a", "b"]),
      ev("messages", "update"),
      ev("x", "insert"),
    );
    fake.last.emit(ev("messages", "insert"));
    expect(screen.getByTestId("badge").textContent).toBe("3");
  });
});

describe("one stream per provider", () => {
  it("two views of a collection share one subscription; the last one out drops it", async () => {
    const d = describeWith({}, { changes: true });
    const { fake, spy } = mount(<Panes />, { describe: d, rows: FOUR }, { changes: FAST });
    await waitFor(() => expect(fake.open).toHaveLength(1));
    expect(fake.last.collections).toEqual(["messages"]);
    const first = fake.last;
    first.open();

    fireEvent.click(screen.getByText("drop a"));
    await sleep(40);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(first.closed).toBe(false);

    fireEvent.click(screen.getByText("drop b"));
    await waitFor(() => expect(first.closed).toBe(true));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("a new collection reopens the stream; the old one carries events until the new one is open", async () => {
    const d = describeWith({}, { changes: true });
    const { fake, calls } = mount(<Panes />, { describe: d, rows: FOUR }, { changes: FAST });
    await waitFor(() => expect(fake.open).toHaveLength(1));
    const old = fake.last;
    old.open();
    await sleep(80);

    fireEvent.click(screen.getByText("add people"));
    await waitFor(() => expect(fake.streams).toHaveLength(2));
    const next = fake.last;
    expect(next.collections).toEqual(["messages", "people"]);
    expect(old.closed).toBe(false);

    // Before the new stream is subscribed, the old one still delivers.
    const before = lists(calls);
    old.emit(ev("messages"));
    await waitFor(() => expect(lists(calls)).toBe(before + 1));

    next.open();
    expect(old.closed).toBe(true);
    await sleep(80);
    const after = lists(calls, "people");
    next.emit(ev("people"));
    await waitFor(() => expect(lists(calls, "people")).toBe(after + 1));
  });
});

describe("polling is the fallback", () => {
  it("while live the timer does not fire; when the stream drops it resumes; reconnected refetches", async () => {
    const d = describeWith({ refresh_interval_ms: 40 }, { changes: true });
    const { calls, fake } = mount(
      <UdcDataView collection="messages" />,
      { describe: d, rows: FOUR },
      {
        changes: FAST,
      },
    );
    await screen.findAllByTestId("row");
    // Not open yet: polling.
    await waitFor(() => expect(lists(calls)).toBeGreaterThanOrEqual(3), { timeout: 2000 });
    expect(feedStatus()).toBeNull();

    await waitFor(() => expect(fake.open).toHaveLength(1));
    fake.last.open();
    expect(feedStatus()).toBe("live");
    await sleep(100);
    const live = lists(calls);
    await sleep(300);
    expect(lists(calls)).toBe(live);

    fake.last.fail();
    expect(feedStatus()).toBe("reconnecting");
    await waitFor(() => expect(lists(calls)).toBeGreaterThanOrEqual(live + 2), { timeout: 2000 });

    fake.last.open(true);
    expect(feedStatus()).toBe("live");
    await sleep(100);
    const back = lists(calls);
    await sleep(300);
    expect(lists(calls)).toBe(back);
  });

  it("reconnected refetches every subscribed collection", async () => {
    const d = describeWith({}, { changes: true });
    const { calls, fake } = mount(<Pane />, { describe: d, rows: FOUR }, { changes: FAST });
    await screen.findByText("4/4");
    await waitFor(() => expect(fake.open).toHaveLength(1));
    fake.last.open();
    await sleep(80);
    const before = { list: lists(calls), lookups: lists(calls, "messages", true) };
    fake.last.fail();
    fake.last.open(true);
    await waitFor(() => expect(lists(calls)).toBe(before.list + 1));
    await waitFor(() => expect(lists(calls, "messages", true)).toBe(before.lookups + 1));
  });

  it("an unauthenticated stream goes to onUnauthenticated and is not reopened", async () => {
    const onUnauthenticated = vi.fn();
    const d = describeWith({ refresh_interval_ms: 40 }, { changes: true });
    const { calls, fake, spy } = mount(
      <UdcDataView collection="messages" />,
      { describe: d, rows: FOUR },
      { changes: FAST, onUnauthenticated },
    );
    await screen.findAllByTestId("row");
    await waitFor(() => expect(fake.open).toHaveLength(1));
    await fake.last.refuse(unauthenticatedError("udc.changes: HTTP 401", { http_status: 401 }));
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(feedStatus()).toBeNull();
    await sleep(100);
    expect(spy).toHaveBeenCalledTimes(1);
    // Polling as without the feed.
    const n = lists(calls);
    await waitFor(() => expect(lists(calls)).toBeGreaterThanOrEqual(n + 2), { timeout: 2000 });
  });
});

describe("what survives an event-driven refetch", () => {
  it("the active row, the selection and an open cell editor", async () => {
    const server: Server = {
      describe: describeWith(
        {
          columns: [{ field: "subject", editable: true }, { field: "from" }],
          bulk_actions: [{ kind: "delete" }],
        },
        { changes: true, mutate: true },
      ),
      rows: FOUR,
    };
    const { fake, calls } = mount(
      <UdcDataView collection="messages" onActiveRowChange={() => {}} />,
      server,
      { changes: FAST },
    );
    await screen.findAllByTestId("row");
    await waitFor(() => expect(fake.open).toHaveLength(1));
    fake.last.open();
    await sleep(80);

    // Activate m2, move to m3; select m1; open the editor on m4's subject and type.
    act(() => rowEl("m2").focus());
    fireEvent.keyDown(document.activeElement as Element, { key: "j" });
    const activeBefore = screen
      .getAllByTestId("row")
      .filter((r) => r.getAttribute("data-active") === "true")
      .map((r) => r.getAttribute("data-row-id"));
    expect(activeBefore).toEqual(["m3"]);
    fireEvent.click(within(rowEl("m1")).getByRole("checkbox"));
    expect(within(rowEl("m1")).getByRole("checkbox")).toBeChecked();
    fireEvent.doubleClick(within(rowEl("m4")).getByTestId("cell-subject"));
    const input = within(await screen.findByTestId("cell-editor")).getByRole("textbox");
    fireEvent.change(input, { target: { value: "Delta, edited" } });

    // Another tab renames m2.
    server.rows = [m("m1", "Alpha"), m("m2", "Bravo 2"), m("m3", "Charlie"), m("m4", "Delta")];
    const before = lists(calls);
    fake.last.emit(ev("messages", "update", ["m2"]));
    await screen.findByText("Bravo 2");
    expect(lists(calls)).toBe(before + 1);

    expect(
      screen
        .getAllByTestId("row")
        .filter((r) => r.getAttribute("data-active") === "true")
        .map((r) => r.getAttribute("data-row-id")),
    ).toEqual(["m3"]);
    expect(within(rowEl("m1")).getByRole("checkbox")).toBeChecked();
    const still = within(screen.getByTestId("cell-editor")).getByRole("textbox");
    expect(still).toHaveValue("Delta, edited");
  });
});

/** An infinite list: loads its second page, and records the fewest rows it drew after that. */
const seen = { min: Number.POSITIVE_INFINITY, loaded: false };
function Infinite() {
  const list = useUdcCollection({
    collection: "messages",
    mode: "infinite",
    pageLimit: 2,
    capabilities: { changes: true },
  });
  const n = list.rows.length;
  useEffect(() => {
    if (n === 4) seen.loaded = true;
    if (seen.loaded) seen.min = Math.min(seen.min, n);
  }, [n]);
  return (
    <>
      <div data-testid="infinite">{list.rows.map((r) => String(r.subject)).join(",")}</div>
      <button type="button" onClick={list.fetchNextPage}>
        more
      </button>
    </>
  );
}

describe("an infinite list", () => {
  it("keeps every loaded page through an event-driven refetch (the scroll position has its rows)", async () => {
    const server: Server = {
      describe: describeWith({}, { changes: true }),
      rows: FOUR,
      pageSize: 2,
    };
    const { fake, calls } = mount(<Infinite />, server, { changes: FAST });
    await screen.findByText("Alpha,Bravo");
    fireEvent.click(screen.getByText("more"));
    await screen.findByText("Alpha,Bravo,Charlie,Delta");
    await waitFor(() => expect(fake.open).toHaveLength(1));
    fake.last.open();
    await sleep(80);

    server.rows = [m("m1", "Alpha"), m("m2", "Bravo"), m("m3", "Charlie 2"), m("m4", "Delta")];
    const before = lists(calls);
    fake.last.emit(ev("messages", "update", ["m3"]));
    await screen.findByText("Alpha,Bravo,Charlie 2,Delta");
    // Both pages were asked again, and the list never shrank meanwhile.
    expect(lists(calls)).toBe(before + 2);
    expect(seen.min).toBe(4);
  });
});
