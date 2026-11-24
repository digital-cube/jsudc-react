import {
  type DescribeResponse,
  type FilterNode,
  type Row,
  SchemaDocSchema,
  ViewConfigSchema,
} from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RENDERERS } from "../src/all";
import { UdcDataView } from "../src/data-view/UdcDataView";
import { decodeFilterParam } from "../src/data-view/urlState";
import { UdcI18nProvider } from "../src/i18n/i18n";
import { LookupValue, useLookupLabels } from "../src/lookup/LookupValue";
import { lookupColor, lookupExtras, lookupLabel } from "../src/lookup/label";
import { defaultUdcLinks, filterHref, followLink, type UdcLinks } from "../src/lookup/links";
import { optionsFilter } from "../src/lookup/options";
import { keyString, lookupKeys, useUdcLookup } from "../src/lookup/useUdcLookup";
import { UdcReactRouterUrlState } from "../src/react-router";
import { editorKind, fromEditorValue, sameValue } from "../src/table/CellEditor";
import { udcKeys } from "../src/udc/keys";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { Toaster, TooltipProvider } from "../src/ui-kit/ui";
import { type Call, listOf, mockUdcFetch, row } from "./fetchMock";

const BOARDS = [
  row("b1", 1, { name: "Roadmap", key: "ROA" }),
  row("b2", 1, { name: "Support", key: "SUP" }),
];
const COLORS: Record<number, string> = { 1: "danger", 2: "red" };
const PEOPLE = Array.from({ length: 60 }, (_, i) =>
  row(`p${i}`, 1, {
    name: `Person ${String(i).padStart(2, "0")}`,
    title: `T${i}`,
    ...(COLORS[i] ? { color: COLORS[i] } : {}),
  }),
);
const TICKETS = [
  row("t1", 3, { title: "One", board_id: "b1", assignees: ["p1", "p2"] }),
  row("t2", 1, { title: "Two", board_id: "b2", assignees: [] }),
  row("t3", 1, { title: "Three", board_id: "gone", assignees: ["p1"] }),
];

const caps = {
  mutate: true,
  subscribe: false,
  total_count: true,
  schema_edit: false,
  config_edit: false,
  reindex: false,
  tree_reparent: false,
  source_yaml: false,
  supported_filter_ops: [],
};

const ticketsSchema = SchemaDocSchema.parse({
  version: "v1",
  fields: {
    title: { type: "string" },
    board_id: { type: "lookup", ref: "boards", label_field: "name" },
    assignees: {
      type: "lookup_array",
      lookup: { collection: "org", label_field: "name", extra_fields: ["title"] },
    },
  },
});

const describes: Record<string, DescribeResponse> = {
  tickets: {
    collection: "tickets",
    capabilities: caps,
    source_kind: "postgres_jsonb",
    schema: ticketsSchema,
    view: ViewConfigSchema.parse({
      columns: [
        { field: "title" },
        { field: "board_id", editable: true },
        { field: "assignees", editable: true },
      ],
      filters: [
        { field: "board_id", kind: "select" },
        { field: "assignees", kind: "select" },
      ],
    }),
    filterable: { fields: [] },
  },
  notes: {
    collection: "notes",
    capabilities: caps,
    source_kind: "postgres_jsonb",
    schema: ticketsSchema,
    view: ViewConfigSchema.parse({ columns: [{ field: "title" }, { field: "assignees" }] }),
    filterable: { fields: [] },
  },
  boards: {
    collection: "boards",
    capabilities: caps,
    source_kind: "postgres_jsonb",
    schema: SchemaDocSchema.parse({
      version: "v1",
      fields: { name: { type: "string" }, key: { type: "string" } },
    }),
    view: ViewConfigSchema.parse({
      columns: [{ field: "name", editable: true }, { field: "key" }],
      row_link: { collection: "tickets", filter: { field: "board_id", value_from: "id" } },
    }),
    filterable: { fields: [] },
  },
};

/** `list` over the fixtures with just enough of the filter DSL: `in`/`eq` on id, `contains`. */
function listRows(body: Record<string, unknown>) {
  const all: Row[] =
    body.collection === "boards" ? BOARDS : body.collection === "org" ? PEOPLE : TICKETS;
  const f = body.filter as FilterNode | undefined;
  let rows = all;
  if (f && "op" in f) {
    if (f.op === "in") {
      const of = (r: Row) => (f.field === "id" ? r.__meta.id : r[f.field]);
      rows = all.filter((r) => (f.value as unknown[]).includes(of(r)));
    } else if (f.op === "contains") {
      const needle = String(f.value).toLowerCase();
      rows = all.filter((r) => String(r[f.field]).toLowerCase().includes(needle));
    }
  }
  const limit = (body.page as { limit?: number } | undefined)?.limit ?? 50;
  return listOf(rows.slice(0, limit), rows.length);
}

function setup(opts: { links?: UdcLinks } = {}) {
  const mock = mockUdcFetch({
    describe: (b) => ({ ok: describes[b.collection as string] }),
    list: (b) => ({ ok: listRows(b) }),
    mutate: (b) => {
      const t = TICKETS.find((r) => r.__meta.id === b.id) as Row;
      return { ok: { row: { ...t, ...(b.row as object) } } };
    },
  });
  const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
  const qc = createUdcQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UdcI18nProvider>
      <UdcProvider
        client={client}
        renderers={RENDERERS}
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
  return { ...mock, qc, wrapper };
}

const lookupCalls = (calls: Call[], collection: string) =>
  calls.filter(
    (c) =>
      c.action === "list" &&
      c.body.collection === collection &&
      (c.body.filter as { field?: string } | undefined)?.field === "id",
  );

afterEach(() => window.history.replaceState(null, "", "/"));

describe("helpers", () => {
  it("normalise keys", () => {
    expect(keyString(7)).toBe("7");
    expect(keyString("a")).toBe("a");
    expect(keyString({ a: 1 })).toBe('{"a":1}');
    expect(lookupKeys(["b", ["a", "b", 3], null, "", undefined, Number.NaN])).toEqual([
      "3",
      "a",
      "b",
    ]);
  });

  it("read labels and extras", () => {
    const lookup = { collection: "org", label_field: "name", extra_fields: ["title", "x"] };
    expect(lookupLabel(PEOPLE[0], lookup)).toBe("Person 00");
    expect(lookupLabel(row("z", 1, { name: "" }), lookup)).toBeUndefined();
    expect(lookupLabel(row("z", 1, { name: 5 }), lookup)).toBe("5");
    expect(lookupExtras(PEOPLE[0], lookup)).toBe("title: T0");
    expect(lookupExtras(undefined, lookup)).toBeUndefined();
    expect(lookupExtras(PEOPLE[0], { collection: "org", label_field: "name" })).toBeUndefined();
  });

  it("read the colour of a row from color_field", () => {
    const lookup = { collection: "org", label_field: "name", color_field: "color" };
    expect(lookupColor(PEOPLE[1], lookup)).toBe("danger");
    expect(lookupColor(row("z", 1, { color: " red " }), lookup)).toBe("red");
    expect(lookupColor(row("z", 1, { color: "" }), lookup)).toBeUndefined();
    expect(lookupColor(row("z", 1, { color: null }), lookup)).toBeUndefined();
    expect(lookupColor(PEOPLE[0], lookup)).toBeUndefined();
    expect(lookupColor(undefined, lookup)).toBeUndefined();
    expect(lookupColor(PEOPLE[1], { collection: "org", label_field: "name" })).toBeUndefined();
  });

  it("builds the search filter of a picker", () => {
    const lookup = { collection: "org", label_field: "name" };
    expect(optionsFilter(lookup, "  ")).toBeUndefined();
    expect(optionsFilter(lookup, " ana ")).toEqual({
      field: "name",
      op: "contains",
      value: "ana",
      case_insensitive: true,
    });
  });

  it("links with ?f= to /c/<collection> by default", () => {
    const href = filterHref(defaultUdcLinks, "tickets", {
      field: "board_id",
      op: "eq",
      value: "b1",
    });
    expect(href?.startsWith("/c/tickets?f=")).toBe(true);
    const f = new URL(href ?? "", "http://x").searchParams.get("f");
    expect(decodeFilterParam(f)).toEqual({ field: "board_id", op: "eq", value: "b1" });
    expect(defaultUdcLinks.href("a b", new URLSearchParams())).toBe("/c/a%20b");
  });

  it("follows a link in the app, or in a new tab with a modifier", () => {
    const links = { href: () => "", navigate: vi.fn() };
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const e = (extra: object) => ({
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      button: 0,
      preventDefault: vi.fn(),
      ...extra,
    });
    followLink(e({}), "/x", links);
    expect(links.navigate).toHaveBeenCalledWith("/x");
    followLink(e({ metaKey: true }), "/y", links);
    followLink(e({ button: 1 }), "/z", links);
    expect(open).toHaveBeenCalledWith("/y", "_blank", "noopener");
    expect(open).toHaveBeenCalledTimes(2);
    open.mockRestore();
  });

  it("the default navigation pushes the address and tells the router", () => {
    const pop = vi.fn();
    window.addEventListener("popstate", pop);
    defaultUdcLinks.navigate("/c/boards?q=1");
    expect(window.location.pathname + window.location.search).toBe("/c/boards?q=1");
    expect(pop).toHaveBeenCalledTimes(1);
    window.removeEventListener("popstate", pop);
  });

  it("edits a lookup through the combobox's pick", () => {
    const def = ticketsSchema.fields.board_id;
    expect(editorKind(def)).toBe("lookup");
    expect(editorKind({ type: "lookup", ref: "Books.Genre" })).toBe("text");
    expect(fromEditorValue({ picked: 7 }, "lookup", def)).toEqual({ value: 7 });
    expect(sameValue(["a"], ["a"])).toBe(true);
    expect(sameValue(["a"], ["a", "b"])).toBe(false);
    expect(sameValue(undefined, [])).toBe(true);
  });
});

describe("useUdcLookup", () => {
  it("asks once, with an in filter over the row id, keyed by the sorted keys", async () => {
    const { wrapper, calls, qc } = setup();
    const { result } = renderHook(() => useUdcLookup("boards", ["b2", "b1", "b2"]), { wrapper });
    await waitFor(() => expect(result.current.rows.size).toBe(2));
    expect(result.current.row("b1")?.name).toBe("Roadmap");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toEqual({
      collection: "boards",
      filter: { field: "id", op: "in", value: ["b1", "b2"] },
      page: { limit: 2 },
    });
    expect(qc.getQueryData(udcKeys.lookup("boards", ["b1", "b2"]))).toBeInstanceOf(Map);
    expect(udcKeys.lookup("boards", ["b1"])).toEqual(["udc", "lookup", "boards", ["b1"]]);
  });

  it("matches a key_field, and asks nothing for no keys", async () => {
    const { wrapper, calls } = setup();
    const lookup = { collection: "boards", label_field: "name", key_field: "key" };
    const { result } = renderHook(() => useUdcLookup(lookup, ["SUP"]), { wrapper });
    await waitFor(() => expect(calls).toHaveLength(1));
    await waitFor(() => expect(result.current.rows.size).toBeGreaterThan(0));
    expect(result.current.row("SUP")?.name).toBe("Support");
    expect(calls[0]?.body.filter).toEqual({ field: "key", op: "in", value: ["SUP"] });
    const none = renderHook(() => useUdcLookup("boards", []), { wrapper });
    expect(none.result.current.isLoading).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

describe("a lookup outside a renderer", () => {
  it("resolves its own key and links to the target", async () => {
    const links = { href: (c: string) => `/udc/${c}`, navigate: vi.fn() };
    const { wrapper } = setup({ links });
    render(<LookupValue def={ticketsSchema.fields.board_id as never} value="b2" />, { wrapper });
    const link = await screen.findByText("Support");
    expect(link).toHaveAttribute("href", "/udc/boards");
    fireEvent.click(link);
    expect(links.navigate).toHaveBeenCalledWith("/udc/boards");
  });

  it("colours a chip from color_field: a tone as its badge, another name by the host's variables", async () => {
    const { wrapper } = setup();
    const def = {
      type: "lookup_array",
      lookup: { collection: "org", label_field: "name", color_field: "color" },
    };
    render(<LookupValue def={def as never} value={["p1", "p2", "p3"]} />, { wrapper });
    await screen.findByText("Person 03");
    const [toned, named, plain] = screen.getAllByTestId("lookup-link") as HTMLElement[];
    expect(toned).toHaveAttribute("data-color", "danger");
    expect(toned).toHaveAttribute("data-tone", "danger");
    expect(toned?.className).toContain("udc:bg-sem-danger-bg");
    expect(toned?.className).not.toContain("udc:bg-muted");
    expect(toned?.getAttribute("style") ?? "").not.toContain("--udc-chip-bg");
    expect(named).toHaveAttribute("data-color", "red");
    expect(named).not.toHaveAttribute("data-tone");
    expect(named?.className).toContain("udc-lookup-chip");
    expect(named?.getAttribute("style")).toContain("var(--udc-chip-bg, var(--muted))");
    expect(named?.getAttribute("style")).toContain("var(--udc-chip-fg, var(--foreground))");
    // No colour on the row: the chip as it always was.
    expect(plain).not.toHaveAttribute("data-color");
    expect(plain?.className).toContain("udc:bg-muted");
    expect(plain?.getAttribute("style") ?? "").not.toContain("--udc-chip-bg");
  });

  it("a long chip ends in an ellipsis inside its box; the last chips give up width first", async () => {
    const { wrapper } = setup();
    const def = { type: "lookup_array", lookup: { collection: "org", label_field: "name" } };
    render(<LookupValue def={def as never} value={["p1", "p2", "p3"]} />, { wrapper });
    await screen.findByText("Person 03");
    const chips = screen.getAllByTestId("lookup-link") as HTMLElement[];
    for (const chip of chips) {
      // At most --udc-chip-max-width wide, allowed below its text's width, never
      // shrink-0 (which kept a chip as wide as its text and let the cell cut it).
      expect(chip.className).toContain("udc:max-w-[var(--udc-chip-max-width,12em)]");
      expect(chip.className).toContain(
        "udc:min-w-[min(var(--udc-chip-min-width,2.5rem),var(--udc-chip-max-width,12em))]",
      );
      expect(chip.className).not.toContain("udc:shrink-0");
      // The weight and the size are the host's to set.
      expect(chip.className).toContain("udc:font-[number:var(--udc-chip-font-weight,500)]");
      expect(chip.className).toContain("udc:text-[length:var(--udc-chip-font-size,11px)]");
      // The text is a block of its own, so text-overflow reaches it: an inline-flex
      // box's bare text is an anonymous flex item that never gets the "…".
      const text = within(chip).getByTestId("lookup-chip-text");
      expect(text.className).toContain("udc:truncate");
      expect(text.className).toContain("udc:min-w-0");
    }
    expect(within(chips[1] as HTMLElement).getByTestId("lookup-chip-text")).toHaveTextContent(
      "Person 02",
    );
    // Each chip shrinks a million times faster than the one before it.
    const shrink = chips.map((c) => Number(c.style.flexShrink));
    expect(shrink).toEqual([1, 1e6, 1e12]);
  });

  it("is plain text, not a link, where the host's links have no route to the target", async () => {
    const links: UdcLinks = {
      href: (c, search) => (c === "org" ? null : `/udc/${c}?${search}`),
      navigate: vi.fn(),
    };
    const { wrapper } = setup({ links });
    const def = { type: "lookup_array", lookup: { collection: "org", label_field: "name" } };
    const onRowClick = vi.fn();
    render(
      // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: a stand-in for a row
      <div onClick={onRowClick}>
        <LookupValue def={def as never} value={["p1", "p2"]} />
        <LookupValue def={ticketsSchema.fields.board_id as never} value="b1" />
      </div>,
      { wrapper },
    );
    await screen.findByText("Person 02");
    const [chip, , board] = screen.getAllByTestId("lookup-link") as HTMLElement[];
    expect(chip?.tagName).toBe("SPAN");
    expect(chip).not.toHaveAttribute("href");
    expect(chip).not.toHaveAttribute("data-link");
    expect(chip?.className).toContain("udc-lookup-chip");
    expect(chip?.className).not.toContain("udc:hover:underline");
    expect(chip?.className).not.toContain("udc:hover:bg-primary/12");
    // The click is the row's.
    fireEvent.click(chip as HTMLElement);
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(links.navigate).not.toHaveBeenCalled();
    // Another target still has its route: a link, whose click stays its own.
    await waitFor(() => expect(board).toHaveTextContent("Roadmap"));
    expect(board?.tagName).toBe("A");
    expect(board).toHaveAttribute("data-link", "true");
    fireEvent.click(board as HTMLElement);
    expect(links.navigate).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("a single lookup is a link, not a chip, and takes no colour", async () => {
    const { wrapper } = setup();
    const def = {
      type: "lookup",
      lookup: { collection: "org", label_field: "name", color_field: "color" },
    };
    render(<LookupValue def={def as never} value="p1" />, { wrapper });
    const link = await screen.findByText("Person 01");
    expect(link).not.toHaveAttribute("data-color");
    expect(link.className).not.toContain("udc-lookup-chip");
  });

  it("gives the labels as strings, the key where none is known", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useLookupLabels(ticketsSchema.fields.assignees, ["p1", "nobody"]),
      { wrapper },
    );
    await waitFor(() => expect(result.current).toEqual(["Person 01", "nobody"]));
    const plain = renderHook(() => useLookupLabels(undefined, ["x"]), { wrapper });
    expect(plain.result.current).toEqual(["x"]);
  });
});

describe("the table over lookup fields", () => {
  it("a click on a chip with no route activates the row (the chip is no link)", async () => {
    const links: UdcLinks = { href: (c) => (c === "org" ? null : `/c/${c}`), navigate: vi.fn() };
    const s = setup({ links });
    const onRowActivate = vi.fn();
    render(<UdcDataView collection="notes" onRowActivate={onRowActivate} />, {
      wrapper: s.wrapper,
    });
    const rows = await screen.findAllByTestId("row");
    const chip = await within(rows[0] as HTMLElement).findByText("Person 02");
    expect(chip.closest("a")).toBeNull();
    fireEvent.click(chip);
    expect(onRowActivate).toHaveBeenCalledTimes(1);
    expect(onRowActivate.mock.calls[0]?.[0]?.__meta.id).toBe("t1");
    expect(links.navigate).not.toHaveBeenCalled();
  });

  it("a row_link to a collection with no route does nothing", async () => {
    const links: UdcLinks = {
      href: (c) => (c === "tickets" ? null : `/c/${c}`),
      navigate: vi.fn(),
    };
    const s = setup({ links });
    render(<UdcDataView collection="boards" />, { wrapper: s.wrapper });
    const rows = await screen.findAllByTestId("row");
    expect(rows[0]).not.toHaveAttribute("data-row-link");
    fireEvent.click(within(rows[0] as HTMLElement).getByText("ROA"));
    expect(links.navigate).not.toHaveBeenCalled();
  });

  async function mountTickets(links?: UdcLinks) {
    const s = setup(links ? { links } : {});
    window.history.replaceState(null, "", "/c/tickets");
    render(<UdcDataView collection="tickets" />, { wrapper: s.wrapper });
    await screen.findAllByTestId("row");
    await waitFor(() => expect(screen.getByText("Roadmap")).toBeInTheDocument());
    return s;
  }

  it("shows labels as links, one batch call per lookup field, the bare key for a missing row", async () => {
    const { calls } = await mountTickets();
    const rows = screen.getAllByTestId("row");
    const board = within(rows[0] as HTMLElement).getAllByTestId("lookup-link")[0] as HTMLElement;
    expect(board).toHaveTextContent("Roadmap");
    expect(board.getAttribute("href")).toMatch(/^\/c\/boards\?f=/);
    expect(await within(rows[0] as HTMLElement).findByText("Person 02")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getAllByTestId("lookup-link")[1]).toHaveAttribute(
      "title",
      "title: T1",
    );
    // `gone` is no board: the key itself, marked unresolved.
    const missing = within(rows[2] as HTMLElement).getAllByTestId("lookup-link")[0];
    expect(missing).toHaveTextContent("gone");
    expect(missing).not.toHaveAttribute("data-resolved");
    expect(lookupCalls(calls, "boards")).toHaveLength(1);
    expect(lookupCalls(calls, "boards")[0]?.body.filter).toEqual({
      field: "id",
      op: "in",
      value: ["b1", "b2", "gone"],
    });
    expect(lookupCalls(calls, "org")).toHaveLength(1);
  });

  it("the select chip lists the target by label and filters by key", async () => {
    const { calls } = await mountTickets();
    fireEvent.click(screen.getByTestId("chip-board_id"));
    const option = await screen.findByTestId("chip-option-b2");
    expect(option).toHaveTextContent("Support");
    fireEvent.click(within(option).getByRole("checkbox"));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.body.collection === "tickets" &&
            JSON.stringify(c.body.filter) ===
              JSON.stringify({ field: "board_id", op: "in", value: ["b2"] }),
        ),
      ).toBe(true),
    );
    // The summary reads the label, not the key.
    await waitFor(() => expect(screen.getByTestId("chip-board_id")).toHaveTextContent("Support"));
  });

  it("searches the target on the server when it has more than 50 rows", async () => {
    const { calls } = await mountTickets();
    fireEvent.click(screen.getByTestId("chip-assignees"));
    const search = await screen.findByTestId("chip-search-assignees");
    expect(screen.getByText(/10 more/)).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "son 59" } });
    expect(await screen.findByTestId("chip-option-p59")).toHaveTextContent("Person 59");
    expect(
      calls.some(
        (c) =>
          c.body.collection === "org" &&
          JSON.stringify(c.body.filter) ===
            JSON.stringify({
              field: "name",
              op: "contains",
              value: "son 59",
              case_insensitive: true,
            }),
      ),
    ).toBe(true);
  });

  it("in an editable cell a plain click on the label stays; Cmd-click opens the target", async () => {
    const links = { href: (c: string) => `/udc/${c}`, navigate: vi.fn() };
    await mountTickets(links);
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const cell = screen.getAllByTestId("cell-board_id")[0] as HTMLElement;
    const link = within(cell).getByTestId("lookup-link");
    fireEvent.click(link);
    expect(links.navigate).not.toHaveBeenCalled();
    fireEvent.click(link, { ctrlKey: true });
    expect(open).toHaveBeenCalledWith("/udc/boards", "_blank", "noopener");
    open.mockRestore();
  });

  it("edits a lookup with the combobox and writes the key", async () => {
    const { calls } = await mountTickets();
    const cell = screen.getAllByTestId("cell-board_id")[0] as HTMLElement;
    fireEvent.doubleClick(cell);
    const input = await within(cell).findByTestId("lookup-search");
    await waitFor(() => expect(input).toHaveAttribute("placeholder", "Roadmap"));
    fireEvent.change(input, { target: { value: "sup" } });
    const option = await within(cell).findByTestId("lookup-option-b2");
    fireEvent.click(option);
    await waitFor(() => expect(calls.some((c) => c.action === "mutate")).toBe(true));
    expect(calls.find((c) => c.action === "mutate")?.body).toMatchObject({
      op: "update",
      id: "t1",
      row: { board_id: "b2" },
      expected_version: 3,
    });
  });

  it("edits a lookup_array: picks add, Backspace removes, Enter writes the list", async () => {
    const { calls } = await mountTickets();
    const cell = screen.getAllByTestId("cell-assignees")[0] as HTMLElement;
    fireEvent.doubleClick(cell);
    const input = await within(cell).findByTestId("lookup-search");
    expect(within(cell).getAllByTestId("lookup-picked")).toHaveLength(2);
    fireEvent.click(await within(cell).findByTestId("lookup-option-p5"));
    expect(within(cell).getAllByTestId("lookup-picked")).toHaveLength(3);
    fireEvent.keyDown(input, { key: "Backspace" });
    fireEvent.keyDown(input, { key: "Backspace" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(calls.some((c) => c.action === "mutate")).toBe(true));
    expect(calls.find((c) => c.action === "mutate")?.body).toMatchObject({
      row: { assignees: ["p1"] },
    });
  });

  it("Escape leaves the combobox without writing", async () => {
    const { calls } = await mountTickets();
    const cell = screen.getAllByTestId("cell-board_id")[1] as HTMLElement;
    fireEvent.doubleClick(cell);
    const input = await within(cell).findByTestId("lookup-search");
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(within(cell).queryByTestId("lookup-combobox")).toBeNull());
    expect(calls.some((c) => c.action === "mutate")).toBe(false);
  });
});

/** Shows where the router is, for the row_link tests. */
function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
}

describe("row_link", () => {
  it("a row click opens the linked collection filtered by the row id, through the router", async () => {
    const s = setup();
    render(
      <MemoryRouter initialEntries={["/udc/boards"]}>
        <UdcReactRouterUrlState collectionPath={(c) => `/udc/${c}`}>
          <UdcDataView collection="boards" />
          <Where />
        </UdcReactRouterUrlState>
      </MemoryRouter>,
      { wrapper: s.wrapper },
    );
    const rows = await screen.findAllByTestId("row");
    expect(rows[1]).toHaveClass("udc:cursor-pointer");
    // An editable cell keeps its click (double-click edits); another cell follows the link.
    fireEvent.click(within(rows[1] as HTMLElement).getByTestId("cell-name"));
    expect(screen.getByTestId("where")).toHaveTextContent("/udc/boards");
    fireEvent.click(within(rows[1] as HTMLElement).getByTestId("cell-key"));
    const where = screen.getByTestId("where").textContent ?? "";
    expect(where.startsWith("/udc/tickets?f=")).toBe(true);
    const f = new URL(where, "http://x").searchParams.get("f");
    expect(decodeFilterParam(f)).toEqual({ field: "board_id", op: "eq", value: "b2" });
  });

  it("the drilled view's filter pill names the board, not its id", async () => {
    const s = setup();
    const f = btoa(JSON.stringify({ field: "board_id", op: "eq", value: "b2" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    window.history.replaceState(null, "", `/c/tickets?f=${f}`);
    render(<UdcDataView collection="tickets" />, { wrapper: s.wrapper });
    await waitFor(() => expect(screen.getByTestId("fb-pill-0")).toHaveTextContent("Support"));
  });

  it("Cmd-click opens a new tab; the row carries its link", async () => {
    const s = setup();
    window.history.replaceState(null, "", "/c/boards");
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<UdcDataView collection="boards" />, { wrapper: s.wrapper });
    const rows = await screen.findAllByTestId("row");
    expect(rows[0]?.getAttribute("data-row-link")).toMatch(/^\/c\/tickets\?f=/);
    fireEvent.click(within(rows[0] as HTMLElement).getByTestId("cell-key"), { metaKey: true });
    expect(open).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/c/boards");
    open.mockRestore();
  });

  it("does nothing in a view without row_link", async () => {
    await act(async () => {});
    const s = setup();
    window.history.replaceState(null, "", "/c/tickets");
    render(<UdcDataView collection="tickets" />, { wrapper: s.wrapper });
    const rows = await screen.findAllByTestId("row");
    expect(rows[0]).not.toHaveClass("udc:cursor-pointer");
    fireEvent.click(within(rows[0] as HTMLElement).getByTestId("cell-title"));
    expect(window.location.pathname).toBe("/c/tickets");
  });
});
