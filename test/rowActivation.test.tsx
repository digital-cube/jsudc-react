// Row activation and keyboard movement (0.4.0, R2): onRowActivate, activeRowId,
// onActiveRowChange on UdcDataView, the table and the cards, and useRowActivation for a host
// renderer.
import { type DescribeResponse, type Row, ViewConfigSchema } from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RENDERERS } from "../src/all";
import { UdcDataView } from "../src/data-view/UdcDataView";
import { useRowActivation } from "../src/headless";
import { UdcI18nProvider } from "../src/i18n/i18n";
import type { UdcLinks } from "../src/lookup/links";
import { createRendererRegistry } from "../src/renderers/registry";
import type { RendererProps } from "../src/renderers/types";
import { tableRenderer } from "../src/table";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { Toaster, TooltipProvider } from "../src/ui-kit/ui";
import { describeMessages } from "./embedFixture";
import { type Call, listOf, mockUdcFetch, row } from "./fetchMock";

const m = (id: string, subject: string) => row(id, 1, { subject, from: "ana", folder: "inbox" });
const FOUR = [m("m1", "Alpha"), m("m2", "Bravo"), m("m3", "Charlie"), m("m4", "Delta")];

function describeWith(view: Record<string, unknown>, mutate = false): DescribeResponse {
  return {
    ...describeMessages,
    capabilities: { ...describeMessages.capabilities, mutate },
    view: ViewConfigSchema.parse({
      available_renderers: ["table", "cards"],
      columns: [{ field: "subject" }, { field: "from" }],
      card_options: { title_field: "subject", meta_fields: ["from"] },
      search: { fields: ["subject"] },
      pagination: "pages",
      page_size_default: 10,
      ...view,
    }),
  };
}

interface Server {
  describe: DescribeResponse;
  /** The rows the next list call answers; a function gets the call's body. */
  rows: Row[] | ((body: Record<string, unknown>) => { rows: Row[]; next: string | null });
}

function mount(ui: ReactNode, server: Server, links?: UdcLinks) {
  const mock = mockUdcFetch({
    describe: () => ({ ok: server.describe }),
    list: (body) => {
      if (typeof server.rows === "function") {
        const { rows, next } = server.rows(body);
        return { ok: listOf(rows, 8, next) };
      }
      return { ok: listOf(server.rows) };
    },
    update: (body) => ({ ok: { row: { __meta: { id: body.id, version: 2 } } } }),
  });
  const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
  const qc = createUdcQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UdcI18nProvider>
      <UdcProvider client={client} renderers={RENDERERS} {...(links ? { links } : {})}>
        <QueryClientProvider client={qc}>
          <TooltipProvider>
            <Toaster>{children}</Toaster>
          </TooltipProvider>
        </QueryClientProvider>
      </UdcProvider>
    </UdcI18nProvider>
  );
  const utils = render(ui, { wrapper });
  return { ...utils, calls: mock.calls as Call[], qc };
}

const rowEl = (id: string) =>
  screen.getAllByTestId("row").find((r) => r.getAttribute("data-row-id") === id) as HTMLElement;
const activeIds = () =>
  screen
    .getAllByTestId("row")
    .filter((r) => r.getAttribute("aria-selected") === "true")
    .map((r) => r.getAttribute("data-row-id"));
const key = (k: string, target: Element = document.activeElement as Element) =>
  fireEvent.keyDown(target, { key: k });
const ids = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls.map((c) => (c[0] as Row | null)?.__meta.id ?? null);

/** A host controlling the active row; with `follow` it moves it in onActiveRowChange. */
const hostSeen: (string | null)[] = [];
function Host({ follow }: { follow: boolean }) {
  const [active, setActive] = useState<string | null>("m2");
  return (
    <UdcDataView
      collection="messages"
      activeRowId={active}
      onActiveRowChange={(r) => {
        hostSeen.push(r?.__meta.id ?? null);
        if (follow) setActive(r?.__meta.id ?? null);
      }}
    />
  );
}

/** A message list of the host's, on @jsudc/react/headless: one <li> per row. */
function MessageList({ data, onRowActivate, activeRowId, onActiveRowChange }: RendererProps) {
  const nav = useRowActivation({
    rows: data.rows,
    onRowActivate,
    activeRowId,
    onActiveRowChange,
  });
  return (
    <ul role={nav.enabled ? "grid" : undefined} data-testid="host-list">
      {data.rows.map((r) => (
        // biome-ignore lint/a11y/useKeyWithClickEvents: the keys come with rowProps
        <li
          key={r.__meta.id}
          data-testid="host-row"
          data-row-id={r.__meta.id}
          role={nav.enabled ? "row" : undefined}
          {...nav.rowProps(r)}
          onClick={(e) => nav.handleClick(e, r)}
        >
          {String(r.subject)}
        </li>
      ))}
    </ul>
  );
}
const renderers = createRendererRegistry(tableRenderer, {
  name: "messages",
  component: MessageList,
  icon: Inbox,
  labelKey: "TAB_MESSAGES",
  paging: true,
  editMode: false,
});

beforeEach(() => window.history.replaceState(null, "", "/c/messages"));
afterEach(() => vi.restoreAllMocks());

describe("row activation in the table", () => {
  it("arrows and j / k move the active row; Home / End jump; Enter and a click activate", async () => {
    const onRowActivate = vi.fn();
    const onActiveRowChange = vi.fn();
    mount(
      <UdcDataView
        collection="messages"
        onRowActivate={onRowActivate}
        onActiveRowChange={onActiveRowChange}
      />,
      { describe: describeWith({}), rows: FOUR },
    );
    await screen.findAllByTestId("row");
    const table = screen.getByTestId("udc-table");
    expect(table).toHaveAttribute("role", "grid");
    // One tab stop for the list: the first row while none is active.
    expect(screen.getAllByTestId("row").map((r) => r.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(activeIds()).toEqual([]);

    act(() => rowEl("m1").focus());
    key("ArrowDown");
    expect(activeIds()).toEqual(["m2"]);
    expect(document.activeElement).toBe(rowEl("m2"));
    expect(rowEl("m2")).toHaveAttribute("data-active", "true");
    expect(rowEl("m2").tabIndex).toBe(0);
    expect(rowEl("m1").tabIndex).toBe(-1);
    // The selected background, on every cell of the row and on no other row.
    for (const td of within(rowEl("m2")).getAllByTestId(/^cell-/)) {
      expect(td).toHaveClass("udc:bg-selected");
    }
    expect(within(rowEl("m1")).getByTestId("cell-subject")).not.toHaveClass("udc:bg-selected");

    key("j");
    expect(activeIds()).toEqual(["m3"]);
    key("k");
    key("ArrowUp");
    expect(activeIds()).toEqual(["m1"]);
    key("ArrowUp"); // already at the top: stays
    expect(activeIds()).toEqual(["m1"]);
    key("End");
    expect(activeIds()).toEqual(["m4"]);
    key("ArrowDown"); // pages mode, last row: stays
    expect(activeIds()).toEqual(["m4"]);
    key("Home");
    expect(activeIds()).toEqual(["m1"]);
    expect(ids(onActiveRowChange)).toEqual(["m2", "m3", "m2", "m1", "m4", "m1"]);
    expect(onRowActivate).not.toHaveBeenCalled();

    key("Enter");
    expect(ids(onRowActivate)).toEqual(["m1"]);

    fireEvent.click(within(rowEl("m3")).getByTestId("cell-from"));
    expect(ids(onRowActivate)).toEqual(["m1", "m3"]);
    expect(activeIds()).toEqual(["m3"]);
    expect(document.activeElement).toBe(rowEl("m3"));
    expect(ids(onActiveRowChange).at(-1)).toBe("m3");

    // Space is not bound (0.5.0 selects with it); modified keys and clicks are not ours.
    key(" ");
    fireEvent.keyDown(rowEl("m3"), { key: "ArrowDown", shiftKey: true });
    fireEvent.click(rowEl("m1"), { ctrlKey: true });
    expect(activeIds()).toEqual(["m3"]);
    expect(onRowActivate).toHaveBeenCalledTimes(2);
  });

  it("typing j in the search box or in a cell editor moves nothing", async () => {
    const onActiveRowChange = vi.fn();
    const describe = describeWith(
      { columns: [{ field: "subject", editable: true }, { field: "from" }] },
      true,
    );
    mount(<UdcDataView collection="messages" onActiveRowChange={onActiveRowChange} />, {
      describe,
      rows: FOUR,
    });
    await screen.findAllByTestId("row");
    act(() => rowEl("m2").focus());
    key("j");
    expect(activeIds()).toEqual(["m3"]);

    const search = within(screen.getByTestId("toolbar")).getByRole("searchbox");
    act(() => search.focus());
    key("j", search);
    key("ArrowDown", search);
    key("Enter", search);
    expect(activeIds()).toEqual(["m3"]);

    // The editor of m3's subject: its keys are the input's.
    fireEvent.doubleClick(within(rowEl("m3")).getByTestId("cell-subject"));
    const editor = await screen.findByTestId("cell-editor");
    const input = within(editor).getByRole("textbox");
    key("j", input);
    key("k", input);
    key("ArrowDown", input);
    key("Home", input);
    expect(activeIds()).toEqual(["m3"]);
    expect(ids(onActiveRowChange)).toEqual(["m3"]);
  });

  it("controlled: the host's activeRowId is drawn, and moves only when the host follows", async () => {
    hostSeen.length = 0;
    const { unmount } = mount(<Host follow={false} />, { describe: describeWith({}), rows: FOUR });
    await screen.findAllByTestId("row");
    expect(activeIds()).toEqual(["m2"]);
    expect(rowEl("m2").tabIndex).toBe(0);
    act(() => rowEl("m2").focus());
    key("ArrowDown");
    expect(hostSeen).toEqual(["m3"]);
    expect(activeIds()).toEqual(["m2"]);
    unmount();

    mount(<Host follow />, { describe: describeWith({}), rows: FOUR });
    await screen.findAllByTestId("row");
    act(() => rowEl("m2").focus());
    key("ArrowDown");
    expect(activeIds()).toEqual(["m3"]);
  });

  it("keeps the active row and the focus by id when the list refetches reordered; a row that left stops being active", async () => {
    const server: Server = { describe: describeWith({}), rows: FOUR };
    const { qc } = mount(<UdcDataView collection="messages" onRowActivate={() => {}} />, server);
    await screen.findAllByTestId("row");
    act(() => rowEl("m1").focus());
    key("j");
    expect(activeIds()).toEqual(["m2"]);

    server.rows = [FOUR[3], FOUR[1], FOUR[2], FOUR[0]] as Row[];
    await act(() => qc.invalidateQueries());
    await waitFor(() =>
      expect(screen.getAllByTestId("row").map((r) => r.getAttribute("data-row-id"))).toEqual([
        "m4",
        "m2",
        "m3",
        "m1",
      ]),
    );
    expect(activeIds()).toEqual(["m2"]);
    expect(document.activeElement).toBe(rowEl("m2"));
    // Movement follows the new order.
    key("ArrowDown");
    expect(activeIds()).toEqual(["m3"]);

    server.rows = [FOUR[0], FOUR[1]] as Row[];
    await act(() => qc.invalidateQueries());
    await waitFor(() => expect(screen.getAllByTestId("row")).toHaveLength(2));
    expect(activeIds()).toEqual([]);
    expect(screen.getAllByTestId("row").map((r) => r.tabIndex)).toEqual([0, -1]);
  });

  it("keeps the active row and the focus by id across a sort", async () => {
    const server: Server = {
      describe: describeWith({}),
      rows: (body) => {
        const desc = JSON.stringify(body.sort ?? []).includes("desc");
        const asc = JSON.stringify(body.sort ?? []).includes("subject");
        return { rows: asc ? (desc ? [...FOUR].reverse() : FOUR) : FOUR, next: null };
      },
    };
    mount(<UdcDataView collection="messages" onRowActivate={() => {}} />, server);
    await screen.findAllByTestId("row");
    act(() => rowEl("m1").focus());
    key("ArrowDown");
    fireEvent.click(screen.getByTestId("sort-subject"));
    fireEvent.click(screen.getByTestId("sort-subject"));
    await waitFor(() =>
      expect(screen.getAllByTestId("row")[0]).toHaveAttribute("data-row-id", "m4"),
    );
    expect(activeIds()).toEqual(["m2"]);
    act(() => rowEl("m2").focus());
    key("ArrowDown");
    expect(activeIds()).toEqual(["m1"]);
  });

  it("infinite mode: ArrowDown on the last loaded row fetches the next page and moves onto it", async () => {
    const server: Server = {
      describe: describeWith({ pagination: "infinite", page_size_default: 2 }),
      rows: (body) =>
        (body.page as { cursor?: string } | undefined)?.cursor === "p2"
          ? { rows: [FOUR[2], FOUR[3]] as Row[], next: null }
          : { rows: [FOUR[0], FOUR[1]] as Row[], next: "p2" },
    };
    const { calls } = mount(<UdcDataView collection="messages" onRowActivate={() => {}} />, server);
    await screen.findAllByTestId("row");
    const cursors = () =>
      calls
        .filter((c) => c.action === "list")
        .map((c) => (c.body.page as { cursor?: string } | undefined)?.cursor);
    expect(cursors()).toEqual([undefined]);
    act(() => rowEl("m1").focus());
    key("ArrowDown");
    key("ArrowDown");
    await waitFor(() => expect(cursors()).toEqual([undefined, "p2"]));
    await waitFor(() => expect(screen.getAllByTestId("row")).toHaveLength(4));
    await waitFor(() => expect(activeIds()).toEqual(["m3"]));
    expect(document.activeElement).toBe(rowEl("m3"));
  });

  it("without any activation prop the rows are as before: no tab stop, no keys, no active row", async () => {
    mount(<UdcDataView collection="messages" />, { describe: describeWith({}), rows: FOUR });
    await screen.findAllByTestId("row");
    expect(screen.getByTestId("udc-table")).not.toHaveAttribute("role");
    for (const r of screen.getAllByTestId("row")) {
      expect(r).not.toHaveAttribute("tabindex");
      expect(r).not.toHaveAttribute("aria-selected");
      expect(r).not.toHaveClass("udc:cursor-pointer");
    }
    fireEvent.click(rowEl("m2"));
    fireEvent.keyDown(rowEl("m2"), { key: "ArrowDown" });
    expect(screen.queryAllByTestId("row").filter((r) => r.hasAttribute("data-active"))).toEqual([]);
  });
});

describe("row activation and row_link", () => {
  const linked = () =>
    describeWith({
      row_link: { collection: "tickets", filter: { field: "folder", value_from: "id" } },
    });
  const spyLinks = () => {
    const navigate = vi.fn();
    const links: UdcLinks = {
      href: (c, search) => `/c/${c}?${search.toString()}`,
      navigate,
    };
    return { links, navigate };
  };

  it("without onRowActivate a plain click still follows the link", async () => {
    const { links, navigate } = spyLinks();
    mount(<UdcDataView collection="messages" />, { describe: linked(), rows: FOUR }, links);
    await screen.findAllByTestId("row");
    fireEvent.click(within(rowEl("m2")).getByTestId("cell-subject"));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toMatch(/^\/c\/tickets\?f=/);
  });

  it("with onRowActivate a plain click activates; Ctrl-click and the middle button follow the link", async () => {
    const { links, navigate } = spyLinks();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const onRowActivate = vi.fn();
    mount(
      <UdcDataView collection="messages" onRowActivate={onRowActivate} />,
      { describe: linked(), rows: FOUR },
      links,
    );
    await screen.findAllByTestId("row");
    fireEvent.click(within(rowEl("m2")).getByTestId("cell-subject"));
    expect(ids(onRowActivate)).toEqual(["m2"]);
    expect(navigate).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(activeIds()).toEqual(["m2"]);

    fireEvent.click(within(rowEl("m3")).getByTestId("cell-subject"), { ctrlKey: true });
    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0]?.[0])).toMatch(/^\/c\/tickets\?f=/);
    fireEvent.click(within(rowEl("m3")).getByTestId("cell-subject"), { metaKey: true });
    expect(open).toHaveBeenCalledTimes(2);
    fireEvent(
      within(rowEl("m4")).getByTestId("cell-subject"),
      new MouseEvent("auxclick", { bubbles: true, button: 1 }),
    );
    expect(open).toHaveBeenCalledTimes(3);
    expect(onRowActivate).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(activeIds()).toEqual(["m2"]);
  });
});

describe("row activation in the cards", () => {
  it("the cards move, activate and show the active one like the table rows", async () => {
    const onRowActivate = vi.fn();
    mount(<UdcDataView collection="messages" onRowActivate={onRowActivate} />, {
      describe: describeWith({ available_renderers: ["cards"], default_renderer: "cards" }),
      rows: FOUR,
    });
    const cards = await screen.findAllByTestId("card");
    expect(screen.getByTestId("card-grid")).toHaveAttribute("role", "grid");
    expect(cards.map((c) => c.getAttribute("role"))).toEqual(["row", "row", "row", "row"]);
    expect(cards.map((c) => c.tabIndex)).toEqual([0, -1, -1, -1]);
    act(() => (cards[0] as HTMLElement).focus());
    key("j");
    key("ArrowDown");
    const card = (id: string) =>
      screen.getAllByTestId("card").find((c) => c.getAttribute("data-row-id") === id);
    expect(card("m3")).toHaveAttribute("aria-selected", "true");
    expect(card("m3")).toHaveClass("udc:bg-selected");
    expect(document.activeElement).toBe(card("m3"));
    key("Enter");
    fireEvent.click(within(card("m1") as HTMLElement).getByTestId("card-title"));
    expect(ids(onRowActivate)).toEqual(["m3", "m1"]);
    expect(card("m1")).toHaveAttribute("data-active", "true");
  });

  it("the active row is the view's: it survives a switch from the table to the cards", async () => {
    mount(<UdcDataView collection="messages" onRowActivate={() => {}} />, {
      describe: describeWith({}),
      rows: FOUR,
    });
    await screen.findAllByTestId("row");
    fireEvent.click(within(rowEl("m3")).getByTestId("cell-subject"));
    fireEvent.click(screen.getByTestId("tab-cards"));
    const cards = await screen.findAllByTestId("card");
    expect(cards.filter((c) => c.getAttribute("aria-selected") === "true")).toHaveLength(1);
    expect(cards.find((c) => c.hasAttribute("data-active"))).toHaveAttribute("data-row-id", "m3");
  });
});

describe("useRowActivation in a host renderer", () => {
  it("gets the activation props from UdcDataView and the same keys from the hook", async () => {
    const onRowActivate = vi.fn();
    mount(
      <UdcDataView collection="messages" renderers={renderers} onRowActivate={onRowActivate} />,
      {
        describe: describeWith({
          available_renderers: ["messages"],
          default_renderer: "messages",
        }),
        rows: FOUR,
      },
    );
    const items = await screen.findAllByTestId("host-row");
    expect(items.map((i) => i.tabIndex)).toEqual([0, -1, -1, -1]);
    act(() => (items[0] as HTMLElement).focus());
    key("End");
    key("k");
    key("Enter");
    expect(ids(onRowActivate)).toEqual(["m3"]);
    const selected = screen
      .getAllByTestId("host-row")
      .filter((i) => i.getAttribute("aria-selected") === "true");
    expect(selected.map((i) => i.getAttribute("data-row-id"))).toEqual(["m3"]);
  });

  it("is off, and the list untouched, without the props", async () => {
    mount(<UdcDataView collection="messages" renderers={renderers} />, {
      describe: describeWith({ available_renderers: ["messages"], default_renderer: "messages" }),
      rows: FOUR,
    });
    const items = await screen.findAllByTestId("host-row");
    expect(screen.getByTestId("host-list")).not.toHaveAttribute("role");
    expect(items[0]).not.toHaveAttribute("tabindex");
  });
});
