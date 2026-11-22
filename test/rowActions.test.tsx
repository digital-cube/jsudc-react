// Row actions in the data view (0.5.0, R1 + S3 3/3): `row_action_defs` / `row_actions`, each
// where its `when` holds, inline or in a menu (also on right-click and from the keyboard), run
// through the bulk path (a host handler by kind, else delete / set / the named server action).
import { type DescribeResponse, type Row, ViewConfigSchema } from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BulkActionContext, BulkActionHandlers } from "../src/actions/bulk";
import {
  eligibleRowActions,
  isRowMenuKey,
  rowActionDefs,
  rowActionsDisplay,
} from "../src/actions/row";
import { RENDERERS } from "../src/all";
import { UdcDataView, type UdcDataViewProps } from "../src/data-view/UdcDataView";
import { UdcI18nProvider } from "../src/i18n/i18n";
import type { Translations } from "../src/i18n/translations";
import type { UdcLinks } from "../src/lookup/links";
import { createRendererRegistry } from "../src/renderers/registry";
import type { RendererProps } from "../src/renderers/types";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { Toaster, TooltipProvider } from "../src/ui-kit/ui";
import { describeMessages } from "./embedFixture";
import { type Call, listOf, mockUdcFetch, row } from "./fetchMock";

const m = (id: string, subject: string, read = false) =>
  row(id, 1, { subject, from: "ana", folder: "inbox", read });
const ROWS = () => [m("m1", "Alpha"), m("m2", "Bravo", true), m("m3", "Charlie")];

const unread = { field: "read", op: "eq", value: false };
/** The README's example: "mark read" through `set`, "archive" through a host handler. */
const DEFS = [
  { kind: "mark_read", label: "Mark read", icon: "mail-open", set: { read: true }, when: unread },
  {
    kind: "archive",
    label: "Archive",
    icon: "archive",
    when: { field: "folder", op: "eq", value: "inbox" },
  },
  { kind: "snooze", label: "Snooze", action: "mail.snooze" },
];

function describeWith(
  view: Record<string, unknown>,
  caps: Partial<DescribeResponse["capabilities"]> = {},
): DescribeResponse {
  return {
    ...describeMessages,
    capabilities: { ...describeMessages.capabilities, mutate: true, ...caps },
    view: ViewConfigSchema.parse({
      available_renderers: ["table", "cards"],
      columns: [{ field: "subject" }, { field: "folder" }],
      card_options: { title_field: "subject" },
      pagination: "pages",
      page_size_default: 10,
      ...view,
    }),
  };
}

type Reply = { ok: unknown } | { err: unknown };

interface Server {
  describe: DescribeResponse;
  rows: Row[];
  handlers?: Record<string, (body: Record<string, unknown>) => Reply | Promise<Reply>>;
}

function mount(
  props: Partial<UdcDataViewProps>,
  server: Server,
  opts: {
    actions?: BulkActionHandlers;
    renderers?: typeof RENDERERS;
    links?: UdcLinks;
    messages?: Translations;
  } = {},
) {
  const mock = mockUdcFetch({
    describe: () => ({ ok: server.describe }),
    list: () => ({ ok: listOf([...server.rows]) }),
    ...server.handlers,
  });
  const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
  const qc = createUdcQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UdcI18nProvider {...(opts.messages ? { messages: opts.messages } : {})}>
      <UdcProvider
        client={client}
        renderers={opts.renderers ?? RENDERERS}
        {...(opts.actions ? { actions: opts.actions } : {})}
        {...(opts.links ? { links: opts.links } : {})}
      >
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

const rowEl = (id: string) =>
  screen.getAllByTestId("row").find((r) => r.getAttribute("data-row-id") === id) as HTMLElement;
const inRow = (id: string) => within(rowEl(id));
const callsOf = (calls: Call[], action: string) => calls.filter((c) => c.action === action);
const kinds = (container: HTMLElement, prefix: string) =>
  Array.from(container.querySelectorAll(`[data-testid^="${prefix}"]`)).map((el) =>
    (el.getAttribute("data-testid") ?? "").slice(prefix.length),
  );
const menu = () => screen.getByTestId("row-actions-menu");
const openMenuOf = (id: string) =>
  fireEvent.keyDown(inRow(id).getByTestId("row-actions-more"), { key: "Enter" });

async function loaded() {
  await screen.findByText("Alpha");
}

describe("which actions a row offers", () => {
  it("row_action_defs when the view has any, else the kinds of row_actions (as udc-js reads them)", () => {
    const typed = ViewConfigSchema.parse({ row_actions: ["delete"], row_action_defs: DEFS });
    expect(rowActionDefs(typed).map((d) => d.kind)).toEqual(["mark_read", "archive", "snooze"]);
    const legacy = ViewConfigSchema.parse({ row_actions: ["delete", "archive"] });
    expect(rowActionDefs(legacy)).toEqual([{ kind: "delete" }, { kind: "archive" }]);
    expect(rowActionDefs(ViewConfigSchema.parse({}))).toEqual([]);
    expect(rowActionsDisplay(ViewConfigSchema.parse({}))).toBe("inline");
    expect(rowActionsDisplay(ViewConfigSchema.parse({ row_actions_display: "menu" }))).toBe("menu");
    const [one, two] = ROWS();
    expect(eligibleRowActions(rowActionDefs(typed), one as Row).map((d) => d.kind)).toEqual([
      "mark_read",
      "archive",
      "snooze",
    ]);
    expect(eligibleRowActions(rowActionDefs(typed), two as Row).map((d) => d.kind)).toEqual([
      "archive",
      "snooze",
    ]);
  });

  it("the menu keys: the context-menu key, Shift+F10 and '.'", () => {
    const k = (
      key: string,
      mods: Partial<Record<"shiftKey" | "ctrlKey" | "altKey" | "metaKey", boolean>> = {},
    ) =>
      isRowMenuKey({
        key,
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        ...mods,
      });
    expect(k("ContextMenu")).toBe(true);
    expect(k("F10", { shiftKey: true })).toBe(true);
    expect(k(".")).toBe(true);
    expect(k("F10")).toBe(false);
    expect(k(".", { ctrlKey: true })).toBe(false);
    expect(k("Enter")).toBe(false);
  });
});

describe("display", () => {
  it("inline: icon buttons in a trailing column; a def whose `when` fails is absent on that row only", async () => {
    mount({}, { describe: describeWith({ row_action_defs: DEFS }), rows: ROWS() });
    await loaded();
    expect(screen.getByTestId("th-actions")).toBeInTheDocument();
    expect(screen.getAllByTestId("cell-actions")).toHaveLength(3);
    // The column is the row's last cell.
    expect(rowEl("m1").lastElementChild).toHaveAttribute("data-testid", "cell-actions");
    expect(kinds(rowEl("m1"), "row-action-")).toEqual(["mark_read", "archive", "snooze"]);
    expect(kinds(rowEl("m2"), "row-action-")).toEqual(["archive", "snooze"]);
    expect(inRow("m1").getByTestId("row-action-mark_read")).toHaveAccessibleName("Mark read");
    expect(screen.queryByTestId("row-actions-more")).toBeNull();
  });

  it("menu: one 'more' button per row, whose dropdown holds the row's eligible actions", async () => {
    mount(
      {},
      {
        describe: describeWith({ row_action_defs: DEFS, row_actions_display: "menu" }),
        rows: ROWS(),
      },
    );
    await loaded();
    expect(screen.getAllByTestId("row-actions-more")).toHaveLength(3);
    expect(screen.queryByTestId("row-action-archive")).toBeNull();
    openMenuOf("m2");
    expect(kinds(menu(), "row-action-item-")).toEqual(["archive", "snooze"]);
    fireEvent.keyDown(menu(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("row-actions-menu")).toBeNull());
    openMenuOf("m1");
    expect(kinds(menu(), "row-action-item-")).toEqual(["mark_read", "archive", "snooze"]);
  });

  it("menu: right-click on the row opens the same menu", async () => {
    mount(
      {},
      {
        describe: describeWith({ row_action_defs: DEFS, row_actions_display: "menu" }),
        rows: ROWS(),
      },
    );
    await loaded();
    const event = fireEvent.contextMenu(inRow("m2").getByTestId("cell-subject"));
    expect(event).toBe(false); // the browser's own menu is not shown
    expect(kinds(menu(), "row-action-item-")).toEqual(["archive", "snooze"]);
  });

  it("a row none of whose actions apply has an empty cell", async () => {
    const defs = [{ kind: "mark_read", set: { read: true }, when: unread }];
    mount({}, { describe: describeWith({ row_action_defs: defs }), rows: ROWS() });
    await loaded();
    expect(inRow("m2").getByTestId("cell-actions")).toBeEmptyDOMElement();
    expect(inRow("m1").getByTestId("row-action-mark_read")).toBeInTheDocument();
  });

  it("the cards: the same actions as a menu on the card", async () => {
    mount(
      {},
      {
        describe: describeWith({ row_action_defs: DEFS, default_renderer: "cards" }),
        rows: ROWS(),
      },
    );
    await loaded();
    const cards = screen.getAllByTestId("card");
    expect(cards).toHaveLength(3);
    const second = cards[1] as HTMLElement;
    fireEvent.keyDown(within(second).getByTestId("row-actions-more"), { key: "Enter" });
    expect(kinds(menu(), "row-action-item-")).toEqual(["archive", "snooze"]);
  });
});

describe("running one", () => {
  it("a host handler gets the one row", async () => {
    const archive = vi.fn((_ctx: BulkActionContext) => {});
    const { calls } = mount(
      { actions: { archive } },
      { describe: describeWith({ row_action_defs: DEFS }), rows: ROWS() },
    );
    await loaded();
    fireEvent.click(inRow("m2").getByTestId("row-action-archive"));
    await waitFor(() => expect(archive).toHaveBeenCalledTimes(1));
    const ctx = archive.mock.calls[0]?.[0] as BulkActionContext;
    expect(ctx.kind).toBe("archive");
    expect(ctx.collection).toBe("messages");
    expect(ctx.ids).toEqual(["m2"]);
    expect(ctx.rows.map((r) => r.__meta.id)).toEqual(["m2"]);
    expect(ctx.row?.__meta.id).toBe("m2");
    expect(ctx.filter).toBeUndefined();
    expect(callsOf(calls, "archive")).toEqual([]);
  });

  it("the provider's handler runs a row action too, from the menu", async () => {
    const archive = vi.fn();
    mount(
      {},
      {
        describe: describeWith({ row_action_defs: DEFS, row_actions_display: "menu" }),
        rows: ROWS(),
      },
      { actions: { archive } },
    );
    await loaded();
    openMenuOf("m3");
    fireEvent.click(screen.getByTestId("row-action-item-archive"));
    await waitFor(() => expect(archive).toHaveBeenCalledTimes(1));
    const ctx = archive.mock.calls[0]?.[0] as BulkActionContext | undefined;
    expect(ctx?.ids).toEqual(["m3"]);
  });

  it("without a handler, delete asks, then mutates and the row goes", async () => {
    const server: Server = {
      describe: describeWith({ row_actions: ["delete"] }),
      rows: ROWS(),
      handlers: {
        mutate: (body) => {
          server.rows = server.rows.filter((r) => r.__meta.id !== body.id);
          return { ok: { row: m(String(body.id), "gone") } };
        },
      },
    };
    const { calls } = mount({}, server);
    await loaded();
    fireEvent.click(inRow("m2").getByTestId("row-action-delete"));
    expect(await screen.findByTestId("row-action-confirm")).toHaveTextContent("Delete this row?");
    expect(callsOf(calls, "mutate")).toEqual([]);
    fireEvent.click(screen.getByTestId("row-action-confirm-ok"));
    await waitFor(() => expect(screen.queryByText("Bravo")).toBeNull());
    expect(callsOf(calls, "mutate")[0]?.body).toEqual({
      collection: "messages",
      op: "delete",
      id: "m2",
    });
  });

  it("with mutate_many, delete removes the row at once through mutate_many", async () => {
    let answer: (r: Reply) => void = () => {};
    const { calls } = mount(
      {},
      {
        describe: describeWith({ row_actions: ["delete"] }, { mutate_many: true }),
        rows: ROWS(),
        handlers: { mutate_many: () => new Promise<Reply>((res) => (answer = res)) },
      },
    );
    await loaded();
    fireEvent.click(inRow("m1").getByTestId("row-action-delete"));
    fireEvent.click(await screen.findByTestId("row-action-confirm-ok"));
    await waitFor(() => expect(screen.queryByText("Alpha")).toBeNull());
    expect(callsOf(calls, "mutate_many")[0]?.body).toEqual({
      collection: "messages",
      op: "delete",
      ids: ["m1"],
    });
    answer({ ok: { updated: 1, failed: [] } });
  });

  it("a cancelled confirmation sends nothing", async () => {
    const { calls } = mount(
      {},
      { describe: describeWith({ row_actions: ["delete"] }), rows: ROWS(), handlers: {} },
    );
    await loaded();
    fireEvent.click(inRow("m1").getByTestId("row-action-delete"));
    fireEvent.click(within(await screen.findByTestId("row-action-confirm")).getByText("Cancel"));
    await waitFor(() => expect(screen.queryByTestId("row-action-confirm")).toBeNull());
    expect(calls.filter((c) => c.action.startsWith("mutate"))).toEqual([]);
  });

  it("a `set` def patches the row at once, before the server answers", async () => {
    let answer: (r: Reply) => void = () => {};
    const { calls } = mount(
      {},
      {
        describe: describeWith({ row_action_defs: DEFS }),
        rows: ROWS(),
        handlers: { mutate: () => new Promise<Reply>((res) => (answer = res)) },
      },
    );
    await loaded();
    fireEvent.click(inRow("m1").getByTestId("row-action-mark_read"));
    // Optimistic: the row reads as read, so "mark read" no longer applies to it.
    await waitFor(() => expect(kinds(rowEl("m1"), "row-action-")).toEqual(["archive", "snooze"]));
    expect(screen.queryByTestId("row-action-confirm")).toBeNull();
    expect(callsOf(calls, "mutate")[0]?.body).toEqual({
      collection: "messages",
      op: "update",
      id: "m1",
      row: { read: true },
    });
    answer({ ok: { row: m("m1", "Alpha", true) } });
  });

  it("a `set` def rolls back when the server fails", async () => {
    mount(
      {},
      {
        describe: describeWith({ row_action_defs: DEFS }),
        rows: ROWS(),
        handlers: { mutate: () => ({ err: { code: "internal", message: "disk full" } }) },
      },
    );
    await loaded();
    fireEvent.click(inRow("m1").getByTestId("row-action-mark_read"));
    await screen.findByText("disk full");
    await waitFor(() =>
      expect(kinds(rowEl("m1"), "row-action-")).toEqual(["mark_read", "archive", "snooze"]),
    );
  });

  it("another kind calls the server action its def names, with the one id", async () => {
    const { calls } = mount(
      {},
      {
        describe: describeWith({ row_action_defs: DEFS }),
        rows: ROWS(),
        handlers: { "mail.snooze": () => ({ ok: { updated: 1, failed: [] } }) },
      },
    );
    await loaded();
    fireEvent.click(inRow("m3").getByTestId("row-action-snooze"));
    await waitFor(() => expect(callsOf(calls, "mail.snooze")).toHaveLength(1));
    expect(callsOf(calls, "mail.snooze")[0]?.body).toEqual({ collection: "messages", ids: ["m3"] });
  });

  it("a server action that names the row as failed shows why", async () => {
    mount(
      {},
      {
        describe: describeWith({ row_action_defs: DEFS }),
        rows: ROWS(),
        handlers: {
          "mail.snooze": () => ({
            ok: { updated: 0, failed: [{ id: "m3", code: "forbidden", message: "not yours" }] },
          }),
        },
      },
    );
    await loaded();
    fireEvent.click(inRow("m3").getByTestId("row-action-snooze"));
    await screen.findByText("Snooze failed");
    expect(screen.getByText("not yours")).toBeInTheDocument();
  });
});

describe("a click on an action stays the action's", () => {
  const linked = (extra: Record<string, unknown> = {}) =>
    describeWith({
      row_action_defs: DEFS,
      multiselect: true,
      row_link: { collection: "tickets", filter: { field: "folder", value_from: "id" } },
      ...extra,
    });
  const spyLinks = () => {
    const navigate = vi.fn();
    const links: UdcLinks = { href: (c, search) => `/c/${c}?${search.toString()}`, navigate };
    return { links, navigate };
  };

  it("does not activate the row, does not change the selection", async () => {
    const onRowActivate = vi.fn();
    const archive = vi.fn();
    mount({ onRowActivate, actions: { archive } }, { describe: linked(), rows: ROWS() });
    await loaded();
    fireEvent.click(inRow("m2").getByTestId("row-action-archive"));
    await waitFor(() => expect(archive).toHaveBeenCalledTimes(1));
    expect(onRowActivate).not.toHaveBeenCalled();
    expect(rowEl("m2")).not.toHaveAttribute("data-active");
    expect(screen.queryByTestId("bulk-bar")).toBeNull();
    expect(rowEl("m2")).not.toHaveAttribute("data-selected");
    // A plain click on the row still activates it.
    fireEvent.click(inRow("m2").getByTestId("cell-subject"));
    expect(onRowActivate).toHaveBeenCalledTimes(1);
  });

  it("does not follow the row_link, from a button or from the menu", async () => {
    const { links, navigate } = spyLinks();
    const archive = vi.fn();
    const a = mount({ actions: { archive } }, { describe: linked(), rows: ROWS() }, { links });
    await loaded();
    fireEvent.click(inRow("m2").getByTestId("row-action-archive"));
    await waitFor(() => expect(archive).toHaveBeenCalledTimes(1));
    expect(navigate).not.toHaveBeenCalled();
    a.unmount();

    mount(
      { actions: { archive } },
      { describe: linked({ row_actions_display: "menu" }), rows: ROWS() },
      { links },
    );
    await loaded();
    fireEvent.click(inRow("m1").getByTestId("row-actions-more"));
    openMenuOf("m1");
    fireEvent.click(screen.getByTestId("row-action-item-archive"));
    await waitFor(() => expect(archive).toHaveBeenCalledTimes(2));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByTestId("bulk-bar")).toBeNull();
    // The row itself still follows its link.
    fireEvent.click(inRow("m1").getByTestId("cell-subject"));
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});

describe("the keyboard", () => {
  it.each([
    ["the context-menu key", { key: "ContextMenu" }],
    ["Shift+F10", { key: "F10", shiftKey: true }],
    ["'.'", { key: "." }],
  ])("%s opens the active row's menu; Escape gives the focus back to the row", async (_n, key) => {
    mount(
      { onRowActivate: () => {} },
      {
        describe: describeWith({ row_action_defs: DEFS, row_actions_display: "menu" }),
        rows: ROWS(),
      },
    );
    await loaded();
    fireEvent.click(inRow("m2").getByTestId("cell-subject"));
    expect(document.activeElement).toBe(rowEl("m2"));
    fireEvent.keyDown(rowEl("m2"), key);
    expect(kinds(menu(), "row-action-item-")).toEqual(["archive", "snooze"]);
    // The focus went into the menu, and comes back on close.
    await waitFor(() => expect(menu().contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("row-actions-menu")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(rowEl("m2")));
  });

  it("in the inline display the keys open the same actions as a menu", async () => {
    mount(
      { onRowActivate: () => {} },
      { describe: describeWith({ row_action_defs: DEFS }), rows: ROWS() },
    );
    await loaded();
    fireEvent.click(inRow("m1").getByTestId("cell-subject"));
    fireEvent.keyDown(rowEl("m1"), { key: "." });
    expect(kinds(menu(), "row-action-item-")).toEqual(["mark_read", "archive", "snooze"]);
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(rowEl("m1")));
  });

  it("on a card too", async () => {
    mount(
      { onRowActivate: () => {} },
      {
        describe: describeWith({ row_action_defs: DEFS, default_renderer: "cards" }),
        rows: ROWS(),
      },
    );
    await loaded();
    const card = screen.getAllByTestId("card")[2] as HTMLElement;
    fireEvent.click(within(card).getByTestId("card-title"));
    expect(document.activeElement).toBe(card);
    fireEvent.keyDown(card, { key: "ContextMenu" });
    expect(kinds(menu(), "row-action-item-")).toEqual(["mark_read", "archive", "snooze"]);
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(card));
  });

  it("the row keys of 0.4.0 still work with row actions on", async () => {
    const onRowActivate = vi.fn();
    mount({ onRowActivate }, { describe: describeWith({ row_action_defs: DEFS }), rows: ROWS() });
    await loaded();
    fireEvent.click(inRow("m1").getByTestId("cell-subject"));
    fireEvent.keyDown(rowEl("m1"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(rowEl("m2"));
    fireEvent.keyDown(rowEl("m2"), { key: "Enter" });
    expect(onRowActivate.mock.calls.map((c) => (c[0] as Row).__meta.id)).toEqual(["m1", "m2"]);
    expect(screen.queryByTestId("row-actions-menu")).toBeNull();
  });
});

/** What the probe renderer was handed, render by render. */
const seen: (RendererProps["rowActions"] | "absent")[] = [];
const rowsSeen: Row[][] = [];
function Probe(p: RendererProps) {
  seen.push("rowActions" in p ? p.rowActions : "absent");
  rowsSeen.push(p.data.rows);
  return <div data-testid="probe">{p.data.rows.length}</div>;
}

describe("as before without row actions", () => {
  it("a view that declares none (or empty lists) renders exactly what it did", async () => {
    const plain = mount({}, { describe: describeWith({}), rows: ROWS() });
    await loaded();
    const before = plain.container.innerHTML;
    expect(screen.queryByTestId("th-actions")).toBeNull();
    expect(screen.queryAllByTestId("cell-actions")).toEqual([]);
    expect(screen.queryByTestId("row-actions")).toBeNull();
    plain.unmount();
    const empty = mount(
      {},
      {
        describe: describeWith({
          row_actions: [],
          row_action_defs: [],
          row_actions_display: "menu",
        }),
        rows: ROWS(),
      },
    );
    await loaded();
    expect(empty.container.innerHTML).toBe(before);
    // A right-click and the menu keys are the browser's.
    expect(fireEvent.contextMenu(inRow("m1").getByTestId("cell-subject"))).toBe(true);
  });

  it("RendererProps carries rowActions when the view declares them, and leaves it out otherwise", async () => {
    seen.length = 0;
    rowsSeen.length = 0;
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
      { describe: describeWith({ row_action_defs: DEFS }), rows: ROWS() },
      { renderers: registry },
    );
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("3"));
    const last = seen.at(-1);
    if (!last || last === "absent") throw new Error("rowActions missing");
    expect(last.display).toBe("inline");
    const second = rowsSeen.at(-1)?.[1] as Row;
    expect(last.eligible(second).map((d) => d.kind)).toEqual(["archive", "snooze"]);
    expect(last.label(DEFS[0] as never)).toBe("Mark read");
    expect(typeof last.run).toBe("function");
    a.unmount();
    seen.length = 0;
    mount({}, { describe: describeWith({}), rows: ROWS() }, { renderers: registry });
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("3"));
    expect(seen.every((s) => s === "absent")).toBe(true);
  });
});

describe("labels", () => {
  it("the collection's term first, then the def's label, then the kind", async () => {
    const messages: Translations = {
      TBL_MESSAGES: { ACTION_ARCHIVE: { en: "File away", sr: "Arhiviraj" } },
    };
    const defs = [...DEFS, { kind: "flag_spam", icon: "flag" }];
    mount({}, { describe: describeWith({ row_action_defs: defs }), rows: ROWS() }, { messages });
    await loaded();
    expect(inRow("m1").getByTestId("row-action-archive")).toHaveAccessibleName("File away");
    expect(inRow("m1").getByTestId("row-action-mark_read")).toHaveAccessibleName("Mark read");
    expect(inRow("m1").getByTestId("row-action-flag_spam")).toHaveAccessibleName("Flag spam");
    expect(screen.getByTestId("th-actions")).toHaveTextContent("Row actions");
  });
});
