// Selection and bulk actions in the data view (0.5.0, R1 + S3): the checkbox column, the
// header checkbox, shift-range, Space, "select all that match" with and without a total, the
// bulk bar, host handlers by kind, and the server paths (mutate_many, a named host action).
import { type DescribeResponse, type FilterNode, type Row, ViewConfigSchema } from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BulkActionHandlers } from "../src/actions/bulk";
import { RENDERERS } from "../src/all";
import { UdcDataView, type UdcDataViewProps } from "../src/data-view/UdcDataView";
import { UdcI18nProvider } from "../src/i18n/i18n";
import { createRendererRegistry } from "../src/renderers/registry";
import type { RendererProps } from "../src/renderers/types";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { Toaster, TooltipProvider } from "../src/ui-kit/ui";
import { describeMessages } from "./embedFixture";
import { type Call, listOf, mockUdcFetch, row } from "./fetchMock";

const m = (id: string, subject: string, read = false) =>
  row(id, 1, { subject, from: "ana", folder: "inbox", read });
const SEVEN = [
  m("m1", "Alpha"),
  m("m2", "Bravo"),
  m("m3", "Charlie"),
  m("m4", "Delta"),
  m("m5", "Echo"),
  m("m6", "Foxtrot"),
  m("m7", "Golf"),
];

const BULK = [
  { kind: "archive" },
  { kind: "mark_read", label: "Mark read", set: { read: true } },
  { kind: "file", label: "File", set: { folder: "filed" } },
  { kind: "snooze", label: "Snooze", action: "mail.snooze" },
  { kind: "delete" },
];

function describeWith(view: Record<string, unknown>): DescribeResponse {
  return {
    ...describeMessages,
    capabilities: { ...describeMessages.capabilities, mutate: true },
    view: ViewConfigSchema.parse({
      available_renderers: ["table", "cards"],
      columns: [{ field: "subject" }, { field: "folder" }],
      card_options: { title_field: "subject" },
      search: { fields: ["subject"] },
      pagination: "pages",
      page_size_default: 3,
      ...view,
    }),
  };
}

type Reply = { ok: unknown } | { err: unknown };

interface Server {
  describe: DescribeResponse;
  rows: Row[];
  /** `null`: the source does not count. */
  total?: number | null;
  handlers?: Record<string, (body: Record<string, unknown>) => Reply | Promise<Reply>>;
}

function mount(
  props: Partial<UdcDataViewProps>,
  server: Server,
  opts: { actions?: BulkActionHandlers; renderers?: typeof RENDERERS } = {},
) {
  const mock = mockUdcFetch({
    describe: () => ({ ok: server.describe }),
    list: (body) => {
      const page = (body.page ?? {}) as { limit?: number; offset?: number };
      const offset = page.offset ?? 0;
      const limit = page.limit ?? 50;
      let rows = [...server.rows];
      const sort = (body.sort ?? []) as { field: string; dir?: string }[];
      if (sort[0]?.dir === "desc") rows.reverse();
      rows = rows.slice(offset, offset + limit);
      const total = server.total === undefined ? server.rows.length : server.total;
      return { ok: { ...listOf(rows), total } };
    },
    mutate_many: () => ({ ok: { updated: 0, failed: [] } }),
    ...server.handlers,
  });
  const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
  const qc = createUdcQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UdcI18nProvider>
      <UdcProvider
        client={client}
        renderers={opts.renderers ?? RENDERERS}
        {...(opts.actions ? { actions: opts.actions } : {})}
      >
        <QueryClientProvider client={qc}>
          <TooltipProvider>
            <Toaster>{children}</Toaster>
          </TooltipProvider>
        </QueryClientProvider>
      </UdcProvider>
    </UdcI18nProvider>
  );
  const ui = (p: Partial<UdcDataViewProps>) => (
    <UdcDataView collection="messages" urlState="memory" {...p} />
  );
  const utils = render(ui(props), { wrapper });
  return {
    ...utils,
    calls: mock.calls as Call[],
    qc,
    rerenderWith: (p: Partial<UdcDataViewProps>) => utils.rerender(ui(p)),
  };
}

const rowEl = (id: string) =>
  screen.getAllByTestId("row").find((r) => r.getAttribute("data-row-id") === id) as HTMLElement;
const checkbox = (id: string) => within(rowEl(id)).getByTestId("select-row") as HTMLInputElement;
const pageBox = () => screen.getByTestId("select-page") as HTMLInputElement;
const count = () => screen.getByTestId("bulk-count");
const callsOf = (calls: Call[], action: string) => calls.filter((c) => c.action === action);

/** What the probe renderer was handed, render by render. */
const seen: (RendererProps["selection"] | "absent")[] = [];
function Probe(p: RendererProps) {
  seen.push("selection" in p ? p.selection : "absent");
  return (
    <button type="button" data-testid="probe" onClick={() => p.selection?.setPage(true)}>
      {p.data.rows.length}
    </button>
  );
}

async function loaded(id = "m1") {
  await screen.findByText(id === "m1" ? "Alpha" : id);
}

describe("selection: on, off, and as in 0.4.0", () => {
  it("a view without multiselect and bulk_actions draws no checkbox and no bar", async () => {
    mount({}, { describe: describeWith({}), rows: SEVEN });
    await loaded();
    expect(screen.queryByTestId("th-select")).toBeNull();
    expect(screen.queryAllByTestId("select-row")).toEqual([]);
    expect(screen.queryByTestId("bulk-bar")).toBeNull();
    expect(screen.getByTestId("udc-table")).not.toHaveAttribute("aria-multiselectable");
  });

  it("is on for `multiselect: true`, for `bulk_actions`, and forced by `selectable`", async () => {
    const a = mount({}, { describe: describeWith({ multiselect: true }), rows: SEVEN });
    await loaded();
    expect(screen.getByTestId("th-select")).toBeInTheDocument();
    a.unmount();
    const b = mount({}, { describe: describeWith({ bulk_actions: BULK }), rows: SEVEN });
    await loaded();
    expect(screen.getAllByTestId("select-row")).toHaveLength(3);
    b.unmount();
    const c = mount(
      { selectable: false },
      { describe: describeWith({ bulk_actions: BULK }), rows: SEVEN },
    );
    await loaded();
    expect(screen.queryByTestId("th-select")).toBeNull();
    c.unmount();
    mount({ selectable: true }, { describe: describeWith({}), rows: SEVEN });
    await loaded();
    expect(screen.getByTestId("th-select")).toBeInTheDocument();
  });
});

describe("the table's checkboxes", () => {
  it("toggle, shift-range, and the header checkbox with its indeterminate state", async () => {
    mount({}, { describe: describeWith({ bulk_actions: BULK }), rows: SEVEN });
    await loaded();
    fireEvent.click(checkbox("m1"));
    expect(checkbox("m1").checked).toBe(true);
    expect(count()).toHaveTextContent("1 selected");
    expect(pageBox().indeterminate).toBe(true);
    expect(rowEl("m1")).toHaveAttribute("data-selected", "true");
    fireEvent.click(checkbox("m3"), { shiftKey: true });
    expect(checkbox("m2").checked).toBe(true);
    expect(count()).toHaveTextContent("3 selected");
    expect(pageBox().checked).toBe(true);
    expect(pageBox().indeterminate).toBe(false);
    fireEvent.click(pageBox());
    expect(screen.queryByTestId("bulk-bar")).toBeNull();
    fireEvent.click(pageBox());
    expect(count()).toHaveTextContent("3 selected");
    fireEvent.click(screen.getByTestId("bulk-clear"));
    expect(screen.queryByTestId("bulk-bar")).toBeNull();
  });

  it("Space toggles the active row; aria-selected is the selection, aria-current the active row", async () => {
    mount(
      { onRowActivate: () => {} },
      { describe: describeWith({ bulk_actions: BULK }), rows: SEVEN },
    );
    await loaded();
    expect(screen.getByTestId("udc-table")).toHaveAttribute("aria-multiselectable", "true");
    fireEvent.click(within(rowEl("m2")).getByText("Bravo"));
    expect(rowEl("m2")).toHaveAttribute("aria-current", "true");
    expect(rowEl("m2")).toHaveAttribute("aria-selected", "false");
    fireEvent.keyDown(rowEl("m2"), { key: " " });
    expect(rowEl("m2")).toHaveAttribute("aria-selected", "true");
    expect(count()).toHaveTextContent("1 selected");
    fireEvent.keyDown(rowEl("m2"), { key: "ArrowDown" });
    fireEvent.keyDown(rowEl("m3"), { key: " ", shiftKey: true });
    expect(count()).toHaveTextContent("2 selected");
    fireEvent.keyDown(rowEl("m3"), { key: " " });
    expect(count()).toHaveTextContent("1 selected");
  });

  it("without selection, 0.4.0's activation keeps aria-selected on the active row", async () => {
    mount({ onRowActivate: () => {} }, { describe: describeWith({}), rows: SEVEN });
    await loaded();
    fireEvent.click(within(rowEl("m2")).getByText("Bravo"));
    expect(rowEl("m2")).toHaveAttribute("aria-selected", "true");
    expect(rowEl("m2")).not.toHaveAttribute("aria-current");
  });

  it("the cards draw a checkbox per card", async () => {
    mount(
      {},
      { describe: describeWith({ bulk_actions: BULK, default_renderer: "cards" }), rows: SEVEN },
    );
    await loaded();
    const boxes = screen.getAllByTestId("select-card");
    expect(boxes).toHaveLength(3);
    fireEvent.click(boxes[0] as HTMLElement);
    expect(count()).toHaveTextContent("1 selected");
    expect(screen.getAllByTestId("card")[0]).toHaveAttribute("data-selected", "true");
  });
});

describe("what keeps and what clears the selection", () => {
  it("cleared by the host filter and by the search; kept by a sort and a refetch", async () => {
    const inbox: FilterNode = { field: "folder", op: "eq", value: "inbox" };
    const { rerenderWith, qc } = mount(
      { filter: inbox },
      { describe: describeWith({ bulk_actions: BULK }), rows: SEVEN },
    );
    await loaded();
    fireEvent.click(checkbox("m2"));
    // A sort: other order, same selection.
    fireEvent.click(screen.getByTestId("sort-subject"));
    fireEvent.click(screen.getByTestId("sort-subject"));
    await waitFor(() =>
      expect(screen.getAllByTestId("row")[0]).toHaveAttribute("data-row-id", "m7"),
    );
    expect(count()).toHaveTextContent("1 selected");
    // A refetch.
    await act(() => qc.invalidateQueries());
    expect(count()).toHaveTextContent("1 selected");
    // The host's filter changes.
    rerenderWith({ filter: { field: "folder", op: "eq", value: "sent" } });
    expect(screen.queryByTestId("bulk-bar")).toBeNull();
    // The search.
    await waitFor(() => expect(screen.getAllByTestId("select-row").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByTestId("select-row")[0] as HTMLElement);
    expect(count()).toHaveTextContent("1 selected");
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "Gol" } });
    await waitFor(() => expect(screen.queryByTestId("bulk-bar")).toBeNull());
  });

  it("RendererProps carries the selection when on, and leaves it out when off", async () => {
    seen.length = 0;
    const registry = createRendererRegistry({
      name: "table",
      component: Probe,
      icon: () => null,
      labelKey: "TAB_TABLE",
      paging: true,
      editMode: false,
    } as never);
    const a = mount(
      {},
      { describe: describeWith({ bulk_actions: BULK }), rows: SEVEN },
      { renderers: registry },
    );
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("3"));
    fireEvent.click(screen.getByTestId("probe"));
    expect(count()).toHaveTextContent("3 selected");
    const last = seen.at(-1);
    expect(last !== "absent" && last?.pageState).toBe("all");
    a.unmount();
    seen.length = 0;
    mount({}, { describe: describeWith({}), rows: SEVEN }, { renderers: registry });
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("3"));
    expect(seen.every((s) => s === "absent")).toBe(true);
  });
});

describe("select all that match", () => {
  it("with a total: 'Select all 7 that match', then 'All 7 are selected'", async () => {
    mount({}, { describe: describeWith({ bulk_actions: BULK }), rows: SEVEN });
    await loaded();
    fireEvent.click(checkbox("m1"));
    expect(screen.queryByTestId("select-all-matching")).toBeNull();
    fireEvent.click(pageBox());
    fireEvent.click(screen.getByTestId("select-all-matching"));
    expect(count()).toHaveTextContent("All 7 are selected");
    expect(screen.getByTestId("bulk-bar")).toHaveAttribute("data-mode", "matching");
    // Taking one out counts down.
    fireEvent.click(checkbox("m2"));
    expect(count()).toHaveTextContent("All 6 are selected");
  });

  it.each([7, null])(
    "when everything is loaded the line is not offered (total %s)",
    async (total) => {
      mount(
        {},
        {
          describe: describeWith({ bulk_actions: BULK, page_size_default: 10 }),
          rows: SEVEN,
          total,
        },
      );
      await loaded();
      fireEvent.click(pageBox());
      expect(count()).toHaveTextContent("7 selected");
      expect(screen.queryByTestId("select-all-matching")).toBeNull();
    },
  );

  it("without a total: no number on the line or the bar, the request by filter, the server's count", async () => {
    const inbox: FilterNode = { field: "folder", op: "eq", value: "inbox" };
    const { calls } = mount(
      { filter: inbox },
      {
        describe: describeWith({ bulk_actions: BULK }),
        rows: SEVEN,
        total: null,
        handlers: { mutate_many: () => ({ ok: { updated: 41, failed: [] } }) },
      },
    );
    await loaded();
    fireEvent.click(pageBox());
    const offer = screen.getByTestId("select-all-matching");
    expect(offer).toHaveTextContent("Select all that match");
    expect(offer.textContent).not.toMatch(/\d/);
    fireEvent.click(offer);
    expect(count()).toHaveTextContent("All matching rows are selected");
    expect(count().textContent).not.toMatch(/\d/);
    expect(count()).not.toHaveAttribute("data-count");
    fireEvent.click(screen.getByTestId("bulk-action-delete"));
    const dialog = await screen.findByTestId("bulk-confirm");
    expect(dialog).toHaveTextContent("Delete all matching rows?");
    fireEvent.click(screen.getByTestId("bulk-confirm-ok"));
    await screen.findByText("41 rows deleted");
    const [req] = callsOf(calls, "mutate_many");
    expect(req?.body).toEqual({ collection: "messages", op: "delete", filter: inbox });
    await waitFor(() => expect(screen.queryByTestId("bulk-bar")).toBeNull());
  });
});

describe("handlers", () => {
  it("a host handler gets ids in id mode and the filter in match mode", async () => {
    const archive = vi.fn();
    const inbox: FilterNode = { field: "folder", op: "eq", value: "inbox" };
    const { calls } = mount(
      { filter: inbox, actions: { archive } },
      { describe: describeWith({ bulk_actions: BULK }), rows: SEVEN },
    );
    await loaded();
    fireEvent.click(checkbox("m1"));
    fireEvent.click(checkbox("m2"));
    fireEvent.click(screen.getByTestId("bulk-action-archive"));
    await waitFor(() => expect(archive).toHaveBeenCalledTimes(1));
    const first = archive.mock.calls[0]?.[0];
    expect(first).toMatchObject({ kind: "archive", collection: "messages", ids: ["m1", "m2"] });
    expect(first.filter).toBeUndefined();
    expect(first.rows.map((r: Row) => r.__meta.id)).toEqual(["m1", "m2"]);
    // The view does not clear on its own; the handler may.
    expect(count()).toHaveTextContent("2 selected");
    act(() => first.clearSelection());
    expect(screen.queryByTestId("bulk-bar")).toBeNull();

    fireEvent.click(pageBox());
    fireEvent.click(screen.getByTestId("select-all-matching"));
    fireEvent.click(checkbox("m3"));
    fireEvent.click(screen.getByTestId("bulk-action-archive"));
    await waitFor(() => expect(archive).toHaveBeenCalledTimes(2));
    const second = archive.mock.calls[1]?.[0];
    expect(second.ids).toBeUndefined();
    expect(second.filter).toEqual(inbox);
    expect(second.exceptIds).toEqual(["m3"]);
    expect(callsOf(calls, "mutate_many")).toEqual([]);
  });

  it("the provider's handler is the default; the view's wins", async () => {
    const fromProvider = vi.fn();
    const fromView = vi.fn();
    const a = mount(
      {},
      { describe: describeWith({ bulk_actions: BULK }), rows: SEVEN },
      { actions: { archive: fromProvider } },
    );
    await loaded();
    fireEvent.click(checkbox("m1"));
    fireEvent.click(screen.getByTestId("bulk-action-archive"));
    await waitFor(() => expect(fromProvider).toHaveBeenCalledTimes(1));
    a.unmount();
    mount(
      { actions: { archive: fromView } },
      { describe: describeWith({ bulk_actions: BULK }), rows: SEVEN },
      { actions: { archive: fromProvider } },
    );
    await loaded();
    fireEvent.click(checkbox("m1"));
    fireEvent.click(screen.getByTestId("bulk-action-archive"));
    await waitFor(() => expect(fromView).toHaveBeenCalledTimes(1));
    expect(fromProvider).toHaveBeenCalledTimes(1);
  });

  it("a host handler that throws shows its message", async () => {
    mount(
      { actions: { archive: () => Promise.reject(new Error("mailbox locked")) } },
      { describe: describeWith({ bulk_actions: BULK }), rows: SEVEN },
    );
    await loaded();
    fireEvent.click(checkbox("m1"));
    fireEvent.click(screen.getByTestId("bulk-action-archive"));
    await screen.findByText("mailbox locked");
    expect(screen.getByText("Archive failed")).toBeInTheDocument();
  });

  it("without a handler, delete asks first, then calls mutate_many delete", async () => {
    const { calls } = mount(
      {},
      {
        describe: describeWith({ bulk_actions: BULK }),
        rows: SEVEN,
        handlers: { mutate_many: () => ({ ok: { updated: 2, failed: [] } }) },
      },
    );
    await loaded();
    fireEvent.click(checkbox("m1"));
    fireEvent.click(checkbox("m2"));
    fireEvent.click(screen.getByTestId("bulk-action-delete"));
    expect(await screen.findByTestId("bulk-confirm")).toHaveTextContent("Delete 2 selected rows?");
    expect(callsOf(calls, "mutate_many")).toEqual([]);
    fireEvent.click(screen.getByTestId("bulk-confirm-ok"));
    await screen.findByText("2 rows deleted");
    expect(callsOf(calls, "mutate_many")[0]?.body).toEqual({
      collection: "messages",
      op: "delete",
      ids: ["m1", "m2"],
    });
  });

  it("a cancelled confirmation sends nothing", async () => {
    const { calls } = mount({}, { describe: describeWith({ bulk_actions: BULK }), rows: SEVEN });
    await loaded();
    fireEvent.click(checkbox("m1"));
    fireEvent.click(screen.getByTestId("bulk-action-delete"));
    const dialog = await screen.findByTestId("bulk-confirm");
    fireEvent.click(within(dialog).getByText("Cancel"));
    await waitFor(() => expect(screen.queryByTestId("bulk-confirm")).toBeNull());
    expect(callsOf(calls, "mutate_many")).toEqual([]);
    expect(count()).toHaveTextContent("1 selected");
  });

  it("a def with `set` updates through mutate_many, without asking", async () => {
    const { calls } = mount(
      {},
      {
        describe: describeWith({ bulk_actions: BULK }),
        rows: SEVEN,
        handlers: { mutate_many: () => ({ ok: { updated: 1, failed: [] } }) },
      },
    );
    await loaded();
    fireEvent.click(checkbox("m3"));
    fireEvent.click(screen.getByTestId("bulk-action-mark_read"));
    await screen.findByText("Mark read: 1 rows");
    expect(screen.queryByTestId("bulk-confirm")).toBeNull();
    expect(callsOf(calls, "mutate_many")[0]?.body).toEqual({
      collection: "messages",
      op: "update",
      ids: ["m3"],
      row: { read: true },
    });
  });

  it("another kind calls the server action its def names, with the selection", async () => {
    const { calls } = mount(
      {},
      {
        describe: describeWith({ bulk_actions: BULK }),
        rows: SEVEN,
        handlers: { "mail.snooze": () => ({ ok: { updated: 2, failed: [] } }) },
      },
    );
    await loaded();
    fireEvent.click(pageBox());
    fireEvent.click(screen.getByTestId("select-all-matching"));
    fireEvent.click(checkbox("m1"));
    fireEvent.click(screen.getByTestId("bulk-action-snooze"));
    await screen.findByText("Snooze: 2 rows");
    expect(callsOf(calls, "mail.snooze")[0]?.body).toEqual({
      collection: "messages",
      filter: { and: [] },
      except_ids: ["m1"],
    });
  });

  it("an unsupported_op answer is an error naming the action", async () => {
    mount(
      {},
      {
        describe: describeWith({ bulk_actions: BULK }),
        rows: SEVEN,
        handlers: {
          archive: () => ({ err: { code: "unsupported_op", message: "unknown action archive" } }),
        },
      },
    );
    await loaded();
    fireEvent.click(checkbox("m1"));
    fireEvent.click(screen.getByTestId("bulk-action-archive"));
    await screen.findByText("The server does not support “Archive”");
    expect(screen.getByText("udc.archive")).toBeInTheDocument();
  });

  it("an action whose `when` fails for a selected row is not offered", async () => {
    const rows = [m("m1", "Alpha"), m("m2", "Bravo", true), m("m3", "Charlie")];
    const defs = [
      { kind: "mark_read", set: { read: true }, when: { field: "read", op: "eq", value: false } },
    ];
    mount({}, { describe: describeWith({ bulk_actions: defs }), rows });
    await loaded();
    fireEvent.click(checkbox("m1"));
    expect(screen.getByTestId("bulk-action-mark_read")).toBeEnabled();
    fireEvent.click(checkbox("m2"));
    expect(screen.getByTestId("bulk-action-mark_read")).toBeDisabled();
  });
});

describe("the optimistic update", () => {
  it("shows at once and rolls back when the server fails", async () => {
    let reject: (r: Reply) => void = () => {};
    mount(
      {},
      {
        describe: describeWith({ bulk_actions: BULK }),
        rows: SEVEN,
        handlers: { mutate_many: () => new Promise<Reply>((res) => (reject = res)) },
      },
    );
    await loaded();
    fireEvent.click(checkbox("m1"));
    fireEvent.click(checkbox("m2"));
    fireEvent.click(screen.getByTestId("bulk-action-file"));
    await waitFor(() =>
      expect(within(rowEl("m1")).getByTestId("cell-folder")).toHaveTextContent("filed"),
    );
    expect(within(rowEl("m2")).getByTestId("cell-folder")).toHaveTextContent("filed");
    expect(within(rowEl("m3")).getByTestId("cell-folder")).toHaveTextContent("inbox");
    reject({ err: { code: "internal", message: "disk full" } });
    await screen.findByText("disk full");
    await waitFor(() =>
      expect(within(rowEl("m1")).getByTestId("cell-folder")).toHaveTextContent("inbox"),
    );
    // The selection stays for a retry.
    expect(count()).toHaveTextContent("2 selected");
  });

  it("a delete removes the loaded rows at once", async () => {
    let answer: (r: Reply) => void = () => {};
    mount(
      {},
      {
        describe: describeWith({ bulk_actions: [{ kind: "delete", confirm: false }] }),
        rows: SEVEN,
        handlers: { mutate_many: () => new Promise<Reply>((res) => (answer = res)) },
      },
    );
    await loaded();
    fireEvent.click(checkbox("m2"));
    fireEvent.click(screen.getByTestId("bulk-action-delete"));
    await waitFor(() =>
      expect(screen.getAllByTestId("row").map((r) => r.getAttribute("data-row-id"))).toEqual([
        "m1",
        "m3",
      ]),
    );
    answer({ ok: { updated: 1, failed: [] } });
    await screen.findByText("1 rows deleted");
  });

  it("reports failed rows by count and keeps them selected", async () => {
    mount(
      {},
      {
        describe: describeWith({ bulk_actions: BULK }),
        rows: SEVEN,
        handlers: {
          mutate_many: () => ({
            ok: { updated: 2, failed: [{ id: "m2", code: "not_found" }] },
          }),
        },
      },
    );
    await loaded();
    fireEvent.click(pageBox());
    fireEvent.click(screen.getByTestId("bulk-action-mark_read"));
    await screen.findByText("1 rows could not be changed");
    expect(screen.getByText("Mark read: 2 rows")).toBeInTheDocument();
    await waitFor(() => expect(count()).toHaveTextContent("1 selected"));
    expect(checkbox("m2").checked).toBe(true);
  });
});

describe("the bar's buttons", () => {
  it("label from i18n, else the def's label; a known icon; a confirm question of the def's own", async () => {
    const defs = [
      { kind: "archive", icon: "lucide:archive" },
      {
        kind: "spam",
        label: "Report spam",
        icon: "lucide:no-such-icon",
        confirm: "Report as spam?",
      },
    ];
    const { calls } = mount(
      {},
      {
        describe: describeWith({ bulk_actions: defs }),
        rows: SEVEN,
        handlers: { spam: () => ({ ok: {} }) },
      },
    );
    await loaded();
    fireEvent.click(checkbox("m1"));
    const archive = screen.getByTestId("bulk-action-archive");
    expect(archive).toHaveTextContent("Archive");
    expect(archive.querySelector("svg")).not.toBeNull();
    const spam = screen.getByTestId("bulk-action-spam");
    expect(spam).toHaveTextContent("Report spam");
    expect(spam.querySelector("svg")).toBeNull();
    fireEvent.click(spam);
    expect(await screen.findByTestId("bulk-confirm")).toHaveTextContent("Report as spam?");
    fireEvent.click(screen.getByTestId("bulk-confirm-ok"));
    await screen.findByText("Report spam: done");
    expect(callsOf(calls, "spam")[0]?.body).toEqual({ collection: "messages", ids: ["m1"] });
  });
});
