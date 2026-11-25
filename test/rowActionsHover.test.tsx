// The `hover` row actions display (0.8.1): a bar of round icon buttons over the row's trailing
// cells while it is hovered or focused, no column of its own, the rest in a "more" dropdown.
// jsdom cannot hover: these tests check what is in the DOM and its classes; the look is checked
// in a real browser.
import { type ActionDef, type DescribeResponse, type Row, ViewConfigSchema } from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BulkActionHandlers } from "../src/actions/bulk";
import { rowActionsColumnWidth } from "../src/actions/RowActionsMenu";
import {
  DEFAULT_ROW_ACTIONS_MAX,
  eligibleRowActions,
  type RowActions,
  rowActionPlacement,
  rowActionsDisplay,
  rowActionsMax,
  splitRowActions,
} from "../src/actions/row";
import { effectiveRowActionsDisplay } from "../src/actions/useCanHover";
import { RENDERERS } from "../src/all";
import { UdcDataView, type UdcDataViewProps } from "../src/data-view/UdcDataView";
import { UdcI18nProvider } from "../src/i18n/i18n";
import type { UdcLinks } from "../src/lookup/links";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { Toaster, TooltipProvider } from "../src/ui-kit/ui";
import { describeMessages } from "./embedFixture";
import { type Call, listOf, mockUdcFetch, row } from "./fetchMock";

const m = (id: string, subject: string, read = false) =>
  row(id, 1, { subject, from: "ana", folder: "inbox", read });
const ROWS = () => [m("m1", "Alpha"), m("m2", "Bravo", true), m("m3", "Charlie")];

const unread = { field: "read", op: "eq", value: false };
const read = { field: "read", op: "eq", value: true };
/** A mailbox: a toggle (mark read / mark unread), an action without an icon, one for the menu. */
const DEFS = [
  { kind: "archive", label: "Archive", icon: "archive" },
  { kind: "delete", label: "Delete" },
  { kind: "mark_read", label: "Mark read", icon: "mail-open", set: { read: true }, when: unread },
  { kind: "mark_unread", label: "Mark unread", icon: "mail", set: { read: false }, when: read },
  { kind: "snooze", label: "Snooze", action: "mail.snooze" },
  { kind: "move", label: "Move to…", icon: "folder-input", placement: "menu" },
];
const hasIcon = (def: ActionDef) => def.icon !== undefined || def.kind === "delete";
const kindsOf = (defs: readonly ActionDef[]) => defs.map((d) => d.kind);

describe("reading the view", () => {
  it("rowActionsDisplay: inline, menu, hover; absent or unknown is inline", () => {
    expect(rowActionsDisplay({ row_actions_display: "inline" })).toBe("inline");
    expect(rowActionsDisplay({ row_actions_display: "menu" })).toBe("menu");
    expect(rowActionsDisplay({ row_actions_display: "hover" })).toBe("hover");
    expect(rowActionsDisplay({})).toBe("inline");
    expect(rowActionsDisplay({ row_actions_display: "popover" })).toBe("inline");
  });

  it("rowActionsMax: a positive integer, else 4", () => {
    expect(DEFAULT_ROW_ACTIONS_MAX).toBe(4);
    expect(rowActionsMax({ row_actions_max: 2 })).toBe(2);
    expect(rowActionsMax({})).toBe(4);
    for (const bad of [0, -1, 1.5, "3", null])
      expect(rowActionsMax({ row_actions_max: bad })).toBe(4);
  });

  it("rowActionPlacement: menu, else bar", () => {
    expect(rowActionPlacement({ kind: "a", placement: "menu" } as ActionDef)).toBe("menu");
    expect(rowActionPlacement({ kind: "a", placement: "bar" } as ActionDef)).toBe("bar");
    expect(rowActionPlacement({ kind: "a" })).toBe("bar");
  });

  it("hover draws as menu on a device that cannot hover", () => {
    expect(effectiveRowActionsDisplay("hover", false)).toBe("menu");
    expect(effectiveRowActionsDisplay("hover", true)).toBe("hover");
    expect(effectiveRowActionsDisplay("inline", false)).toBe("inline");
  });
});

describe("splitRowActions", () => {
  const unreadRow = m("m1", "Alpha");
  const readRow = m("m2", "Bravo", true);
  const split = (r: Row, max?: number) =>
    splitRowActions(eligibleRowActions(DEFS as ActionDef[], r), { hasIcon, max });

  it("bar: the eligible defs with an icon, not placement: menu, in declared order; overflow: the rest", () => {
    const s = split(unreadRow);
    expect(kindsOf(s.bar)).toEqual(["archive", "delete", "mark_read"]);
    expect(kindsOf(s.overflow)).toEqual(["snooze", "move"]);
  });

  it("counts a when-gated def only where it is eligible (the read / unread toggle)", () => {
    expect(kindsOf(split(readRow).bar)).toEqual(["archive", "delete", "mark_unread"]);
    expect(kindsOf(split(readRow).overflow)).toEqual(["snooze", "move"]);
  });

  it("caps the bar at max; what does not fit overflows, in declared order", () => {
    const s = split(unreadRow, 2);
    expect(kindsOf(s.bar)).toEqual(["archive", "delete"]);
    expect(kindsOf(s.overflow)).toEqual(["mark_read", "snooze", "move"]);
  });

  it("the default cap is 4", () => {
    const many = ["a", "b", "c", "d", "e", "f"].map((kind) => ({ kind, icon: "star" }));
    const s = splitRowActions(many, { hasIcon });
    expect(kindsOf(s.bar)).toEqual(["a", "b", "c", "d"]);
    expect(kindsOf(s.overflow)).toEqual(["e", "f"]);
  });

  it("nothing eligible: both empty", () => {
    expect(splitRowActions([], { hasIcon })).toEqual({ bar: [], overflow: [] });
  });
});

describe("rowActionsColumnWidth", () => {
  const ra = (display: RowActions["display"]) =>
    ({
      display,
      defs: DEFS as ActionDef[],
      label: (d: ActionDef) => d.label ?? d.kind,
    }) as unknown as RowActions;
  it("is 0 for hover, 40 for menu, and hover on touch (drawn as menu) is 40", () => {
    expect(rowActionsColumnWidth(ra("hover"))).toBe(0);
    expect(rowActionsColumnWidth(ra("menu"))).toBe(40);
    expect(rowActionsColumnWidth(ra("hover"), "menu")).toBe(40);
  });
});

// ---- the table ----------------------------------------------------------------------------

/**
 * A describe answer with `view` parsed as the server would, then the 0.8.1 keys put on as
 * they are: the client below hands it to the view as it is, so these tests pass against a
 * `@jsudc/core` whose enum has no `hover` yet (0.8.0) as well as against the new one.
 */
function describeWith(view: Record<string, unknown>): DescribeResponse {
  const { row_actions_display, row_actions_max, ...rest } = view;
  const parsed = ViewConfigSchema.parse({
    available_renderers: ["table", "cards"],
    columns: [{ field: "subject" }, { field: "folder" }],
    card_options: { title_field: "subject" },
    pagination: "pages",
    page_size_default: 10,
    ...rest,
  });
  return {
    ...describeMessages,
    capabilities: { ...describeMessages.capabilities, mutate: true },
    view: {
      ...parsed,
      ...(row_actions_display !== undefined ? { row_actions_display } : {}),
      ...(row_actions_max !== undefined ? { row_actions_max } : {}),
    } as DescribeResponse["view"],
  };
}
const hover = (extra: Record<string, unknown> = {}) =>
  describeWith({ row_action_defs: DEFS, row_actions_display: "hover", ...extra });

type Reply = { ok: unknown } | { err: unknown };

function mount(
  props: Partial<UdcDataViewProps>,
  server: {
    describe: DescribeResponse;
    rows: Row[];
    handlers?: Record<string, (b: Record<string, unknown>) => Reply | Promise<Reply>>;
  },
  opts: { actions?: BulkActionHandlers; links?: UdcLinks } = {},
) {
  const mock = mockUdcFetch({
    list: () => ({ ok: listOf([...server.rows]) }),
    ...server.handlers,
  });
  const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
  client.describe = async () => server.describe;
  const qc = createUdcQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UdcI18nProvider>
      <UdcProvider
        client={client}
        renderers={RENDERERS}
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
  return { ...utils, calls: mock.calls as Call[] };
}

const rowEl = (id: string) =>
  screen.getAllByTestId("row").find((r) => r.getAttribute("data-row-id") === id) as HTMLElement;
const inRow = (id: string) => within(rowEl(id));
const kinds = (container: HTMLElement, prefix: string) =>
  Array.from(container.querySelectorAll(`[data-testid^="${prefix}"]`)).map((el) =>
    (el.getAttribute("data-testid") ?? "").slice(prefix.length),
  );
const menu = () => screen.getByTestId("row-actions-menu");
const spinnerIn = (el: Element) => el.querySelector('[class*="animate-spin"]');
const loaded = () => screen.findByText("Alpha");

/** The header cells and the widths of the columns: what the layout of the table is. */
function layout(container: HTMLElement) {
  const table = container.querySelector("table") as HTMLTableElement;
  return {
    width: table.style.width,
    headers: Array.from(table.querySelectorAll("thead th"))
      .filter((th) => (th as HTMLElement).style.width !== "0px")
      .map((th) => [th.getAttribute("data-testid"), (th as HTMLElement).style.width]),
    cols: Array.from(table.querySelectorAll("col"))
      .map((c) => c.style.width)
      .filter((w) => w !== "0px"),
  };
}

describe("hover in the table", () => {
  it("takes no width: the header and the columns are those of the same view without row actions", async () => {
    const a = mount({}, { describe: hover(), rows: ROWS() });
    await loaded();
    const withBar = layout(a.container);
    expect(screen.queryByTestId("th-actions")).toBeNull();
    a.unmount();
    const b = mount({}, { describe: describeWith({}), rows: ROWS() });
    await loaded();
    expect(withBar).toEqual(layout(b.container));
  });

  it("right-pinned columns are not shifted", async () => {
    const pinned = { columns: [{ field: "subject" }, { field: "folder", pin: "right" }] };
    const a = mount({}, { describe: hover(pinned), rows: ROWS() });
    await loaded();
    const right = inRow("m1").getByTestId("cell-folder").style.right;
    a.unmount();
    mount({}, { describe: describeWith(pinned), rows: ROWS() });
    await loaded();
    expect(inRow("m1").getByTestId("cell-folder").style.right).toBe(right);
    expect(right).toBe("0px");
  });

  it("draws the bar's buttons with their labels, the ⋮ only with overflow", async () => {
    mount({}, { describe: hover(), rows: ROWS() });
    await loaded();
    const bar = inRow("m1").getByTestId("row-actions");
    expect(bar).toHaveAttribute("data-display", "hover");
    expect(kinds(bar, "row-action-")).toEqual(["archive", "delete", "mark_read"]);
    expect(inRow("m1").getByTestId("row-action-archive")).toHaveAccessibleName("Archive");
    expect(inRow("m1").getByTestId("row-action-delete")).toHaveAccessibleName("Delete");
    expect(kinds(rowEl("m2"), "row-action-")).toEqual(["archive", "delete", "mark_unread"]);
    // Round icon buttons; hidden until the row is hovered or focused, but in the tab order.
    const button = inRow("m1").getByTestId("row-action-archive");
    expect(button.className).toContain("udc:rounded-full");
    expect(button.className).toContain("udc:size-8");
    expect(button).not.toHaveAttribute("tabindex", "-1");
    expect(bar.className).toContain("udc:opacity-0");
    expect(bar.className).toContain("udc:pointer-events-none");
    expect(bar.className).toContain("udc:group-hover/row:opacity-100");
    expect(bar.className).toContain("udc:focus-within:opacity-100");
    // The kind delete keeps the danger colours.
    expect(inRow("m1").getByTestId("row-action-delete").className).toContain("udc:text-sem-danger");
    // The ⋮ holds the overflow, in declared order.
    fireEvent.click(inRow("m1").getByTestId("row-actions-more"));
    fireEvent.keyDown(inRow("m1").getByTestId("row-actions-more"), { key: "Enter" });
    expect(kinds(menu(), "row-action-item-")).toEqual(["snooze", "move"]);
  });

  it("no ⋮ when nothing overflows; a row with no eligible action draws nothing", async () => {
    const defs = [
      { kind: "archive", label: "Archive", icon: "archive" },
      { kind: "mark_read", label: "Mark read", icon: "mail-open", when: unread },
    ];
    mount({}, { describe: hover({ row_action_defs: defs }), rows: ROWS() });
    await loaded();
    expect(screen.queryByTestId("row-actions-more")).toBeNull();
    expect(kinds(rowEl("m1"), "row-action-")).toEqual(["archive", "mark_read"]);
    const only = [{ kind: "mark_read", label: "Mark read", icon: "mail-open", when: unread }];
    const b = mount({}, { describe: hover({ row_action_defs: only }), rows: ROWS() });
    await waitFor(() =>
      expect(b.container.querySelectorAll('[data-testid="row"]')).toHaveLength(3),
    );
    const m2 = within(b.container.querySelector('[data-row-id="m2"]') as HTMLElement).getByTestId(
      "cell-actions",
    );
    expect(m2).toBeEmptyDOMElement();
  });

  it("row_actions_max caps the bar; the rest goes to the ⋮", async () => {
    mount({}, { describe: hover({ row_actions_max: 2 }), rows: ROWS() });
    await loaded();
    expect(kinds(inRow("m1").getByTestId("row-actions"), "row-action-")).toEqual([
      "archive",
      "delete",
    ]);
    fireEvent.keyDown(inRow("m1").getByTestId("row-actions-more"), { key: "Enter" });
    expect(kinds(menu(), "row-action-item-")).toEqual(["mark_read", "snooze", "move"]);
  });

  it("a click on a bar button runs the action: no activation, no row_link, no selection change", async () => {
    const navigate = vi.fn();
    const links: UdcLinks = { href: (c, s) => `/c/${c}?${s.toString()}`, navigate };
    const archive = vi.fn();
    const linked = hover({
      multiselect: true,
      row_link: { collection: "tickets", filter: { field: "folder", value_from: "id" } },
    });
    const a = mount({ actions: { archive } }, { describe: linked, rows: ROWS() }, { links });
    await loaded();
    fireEvent.click(inRow("m2").getByTestId("row-action-archive"));
    fireEvent.doubleClick(inRow("m2").getByTestId("row-action-archive"));
    await waitFor(() => expect(archive).toHaveBeenCalledTimes(1));
    expect(archive.mock.calls[0]?.[0].ids).toEqual(["m2"]);
    expect(navigate).not.toHaveBeenCalled();
    expect(rowEl("m2")).not.toHaveAttribute("data-selected");
    expect(screen.queryByTestId("bulk-bar")).toBeNull();
    // A right-click inside the bar opens no row menu either.
    fireEvent.contextMenu(inRow("m2").getByTestId("row-action-archive"));
    expect(screen.queryByTestId("row-actions-menu")).toBeNull();
    // The row itself still follows its link.
    fireEvent.click(inRow("m2").getByTestId("cell-subject"));
    expect(navigate).toHaveBeenCalledTimes(1);
    a.unmount();

    const onRowActivate = vi.fn();
    mount({ onRowActivate, actions: { archive } }, { describe: linked, rows: ROWS() }, { links });
    await loaded();
    fireEvent.click(inRow("m1").getByTestId("row-action-archive"));
    await waitFor(() => expect(archive).toHaveBeenCalledTimes(2));
    expect(onRowActivate).not.toHaveBeenCalled();
    expect(rowEl("m1")).not.toHaveAttribute("data-active");
    fireEvent.click(inRow("m1").getByTestId("cell-subject"));
    expect(onRowActivate).toHaveBeenCalledTimes(1);
  });

  it("a `set` def from the bar patches the row, and the toggle flips", async () => {
    const rows = ROWS();
    const { calls } = mount(
      {},
      {
        describe: hover(),
        rows,
        handlers: {
          mutate: () => {
            rows[0] = row("m1", 2, { subject: "Alpha", from: "ana", folder: "inbox", read: true });
            return { ok: { row: rows[0] } };
          },
        },
      },
    );
    await loaded();
    fireEvent.click(inRow("m1").getByTestId("row-action-mark_read"));
    await waitFor(() =>
      expect(kinds(inRow("m1").getByTestId("row-actions"), "row-action-")).toEqual([
        "archive",
        "delete",
        "mark_unread",
      ]),
    );
    expect(calls.filter((c) => c.action === "mutate")[0]?.body).toMatchObject({
      id: "m1",
      row: { read: true },
    });
  });

  it("right-click and the menu key open a menu with every eligible action", async () => {
    mount({ onRowActivate: () => {} }, { describe: hover(), rows: ROWS() });
    await loaded();
    const event = fireEvent.contextMenu(inRow("m2").getByTestId("cell-subject"));
    expect(event).toBe(false);
    expect(kinds(menu(), "row-action-item-")).toEqual([
      "archive",
      "delete",
      "mark_unread",
      "snooze",
      "move",
    ]);
    // The bar stays shown while its row's menu is open.
    expect(inRow("m2").getByTestId("row-actions")).toHaveAttribute("data-shown", "true");
    fireEvent.keyDown(menu(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("row-actions-menu")).toBeNull());

    fireEvent.click(inRow("m1").getByTestId("cell-subject"));
    expect(document.activeElement).toBe(rowEl("m1"));
    fireEvent.keyDown(rowEl("m1"), { key: "ContextMenu" });
    expect(kinds(menu(), "row-action-item-")).toEqual([
      "archive",
      "delete",
      "mark_read",
      "snooze",
      "move",
    ]);
    await waitFor(() => expect(menu().contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(rowEl("m1")));
  });

  it("busy: the spinner in the running action's button (in the ⋮ for an overflow one), the rest disabled", async () => {
    let done: () => void = () => {};
    const archive = vi.fn(() => new Promise<void>((res) => (done = res)));
    const snooze = vi.fn(() => new Promise<void>((res) => (done = res)));
    mount({ actions: { archive, snooze } }, { describe: hover(), rows: ROWS() });
    await loaded();
    fireEvent.click(inRow("m1").getByTestId("row-action-archive"));
    await waitFor(() =>
      expect(spinnerIn(inRow("m1").getByTestId("row-action-archive"))).not.toBeNull(),
    );
    expect(inRow("m1").getByTestId("row-action-delete")).toBeDisabled();
    expect(inRow("m1").getByTestId("row-actions-more")).toBeDisabled();
    expect(spinnerIn(inRow("m1").getByTestId("row-actions-more"))).toBeNull();
    expect(inRow("m1").getByTestId("row-actions")).toHaveAttribute("data-shown", "true");
    done();
    await waitFor(() => expect(inRow("m1").getByTestId("row-action-delete")).not.toBeDisabled());
    expect(inRow("m1").getByTestId("row-actions")).not.toHaveAttribute("data-shown");

    fireEvent.keyDown(inRow("m1").getByTestId("row-actions-more"), { key: "Enter" });
    fireEvent.click(screen.getByTestId("row-action-item-snooze"));
    await waitFor(() =>
      expect(spinnerIn(inRow("m1").getByTestId("row-actions-more"))).not.toBeNull(),
    );
    expect(inRow("m1").getByTestId("row-action-archive")).toBeDisabled();
    done();
    await waitFor(() => expect(spinnerIn(inRow("m1").getByTestId("row-actions-more"))).toBeNull());
  });

  it("the bar wears the row's background: hover, selected, the row_color tone", async () => {
    mount(
      { onRowActivate: () => {} },
      {
        describe: hover({
          row_color: { field: "folder", rules: [{ value: "spam", bg: "warning" }] },
        }),
        rows: [
          m("m1", "Alpha"),
          m("m2", "Bravo", true),
          row("m3", 1, { subject: "Spam", folder: "spam", read: false }),
        ],
      },
    );
    await loaded();
    const bar = (id: string) => inRow(id).getByTestId("row-actions").className;
    expect(bar("m1")).toContain("udc:group-hover/row:bg-hover");
    expect(bar("m3")).not.toContain("udc:group-hover/row:bg-hover");
    expect(bar("m3")).toMatch(/udc:bg-sem-warning/);
    fireEvent.click(inRow("m1").getByTestId("cell-subject"));
    await waitFor(() => expect(bar("m1")).toContain("udc:bg-selected"));
  });
});

describe("hover on a device that cannot hover", () => {
  const real = window.matchMedia;
  afterEach(() => {
    window.matchMedia = real;
  });
  const touch = () => {
    window.matchMedia = vi.fn((q: string) => ({
      matches: q === "(hover: none)",
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  };

  it("draws exactly as menu: the 40 px column with the ⋮", async () => {
    touch();
    const a = mount({}, { describe: hover(), rows: ROWS() });
    await loaded();
    const asHover = {
      layout: layout(a.container),
      th: screen.getByTestId("th-actions").style.width,
      more: screen.getAllByTestId("row-actions-more").length,
      display: inRow("m1").getByTestId("row-actions").getAttribute("data-display"),
      bar: screen.queryAllByTestId("row-action-archive").length,
    };
    a.unmount();
    mount(
      {},
      {
        describe: describeWith({ row_action_defs: DEFS, row_actions_display: "menu" }),
        rows: ROWS(),
      },
    );
    await loaded();
    expect(asHover).toEqual({
      layout: layout(document.body),
      th: "40px",
      more: 3,
      display: "menu",
      bar: 0,
    });
    fireEvent.keyDown(inRow("m1").getByTestId("row-actions-more"), { key: "Enter" });
    expect(kinds(menu(), "row-action-item-")).toHaveLength(5);
  });
});

describe("hover in the cards", () => {
  it("the cards draw the menu", async () => {
    mount({}, { describe: hover({ default_renderer: "cards" }), rows: ROWS() });
    await loaded();
    const card = screen.getAllByTestId("card")[1] as HTMLElement;
    expect(within(card).getByTestId("row-actions")).toHaveAttribute("data-display", "menu");
    expect(within(card).queryByTestId("row-action-archive")).toBeNull();
    fireEvent.keyDown(within(card).getByTestId("row-actions-more"), { key: "Enter" });
    expect(kinds(menu(), "row-action-item-")).toEqual([
      "archive",
      "delete",
      "mark_unread",
      "snooze",
      "move",
    ]);
  });
});

// Only against a core that knows `hover` (0.8.1): the describe answer goes through the client's
// own parse, as in a host, and the bar is drawn.
const coreKnowsHover = ViewConfigSchema.safeParse({ row_actions_display: "hover" }).success;
describe.runIf(coreKnowsHover)("with a core that knows hover", () => {
  it("the describe answer parses and the table draws the bar", async () => {
    const view = ViewConfigSchema.parse({
      columns: [{ field: "subject" }, { field: "folder" }],
      pagination: "pages",
      row_action_defs: DEFS,
      row_actions_display: "hover",
      row_actions_max: 2,
    });
    const answer = { ...describeMessages, view };
    const mock = mockUdcFetch({
      describe: () => ({ ok: answer }),
      list: () => ({ ok: listOf(ROWS()) }),
    });
    const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
    render(
      <UdcI18nProvider>
        <UdcProvider client={client} renderers={RENDERERS}>
          <QueryClientProvider client={createUdcQueryClient()}>
            <TooltipProvider>
              <Toaster>
                <UdcDataView collection="messages" urlState="memory" />
              </Toaster>
            </TooltipProvider>
          </QueryClientProvider>
        </UdcProvider>
      </UdcI18nProvider>,
    );
    await loaded();
    expect(kinds(inRow("m1").getByTestId("row-actions"), "row-action-")).toEqual([
      "archive",
      "delete",
    ]);
    expect(inRow("m1").getByTestId("row-actions-more")).toBeInTheDocument();
  });
});
