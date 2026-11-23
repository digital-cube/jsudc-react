import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { resolveChrome, UdcDataView } from "../src/data-view/UdcDataView";
import { decodeFilterParam, encodeFilterParam } from "../src/data-view/urlState";
import { pagingStorageKey } from "../src/data-view/useDataViewState";
import { at, INBOX, listFilters, mountWith } from "./embedFixture";

const SUBJECT = { field: "subject", op: "contains", value: "inv" } as const;

afterEach(() => at("/"));

describe("a host filter", () => {
  it("is ANDed into the paged list's request, absent from the URL and the pills, and survives clear", async () => {
    at(`/?f=${encodeFilterParam(SUBJECT)}`);
    const { calls } = mountWith(<UdcDataView collection="messages" filter={INBOX} />);
    await screen.findByTestId("udc-table");
    await waitFor(() => expect(listFilters(calls)).toContainEqual({ and: [INBOX, SUBJECT] }));

    // The URL holds the user's filter only; one pill, the user's.
    const params = new URLSearchParams(window.location.search);
    expect(decodeFilterParam(params.get("f"))).toEqual(SUBJECT);
    expect(window.location.search).not.toContain("folder");
    expect(screen.getByTestId("fb-pill-0")).toBeInTheDocument();
    expect(screen.queryByTestId("fb-pill-1")).toBeNull();
    expect(screen.getByTestId("filter-pills").textContent).not.toMatch(/folder|inbox/i);

    // "Clear" drops the user's filter; the host's stays in the request.
    fireEvent.click(
      within(screen.getByTestId("filter-pills")).getByRole("button", { name: "Clear" }),
    );
    await waitFor(() => expect(screen.queryByTestId("filter-pills")).toBeNull());
    expect(new URLSearchParams(window.location.search).get("f")).toBeNull();
    await waitFor(() => expect(listFilters(calls).at(-1)).toEqual(INBOX));
  });

  it("is in the request of a renderer that loads its own rows (the map)", async () => {
    at("/?tab=map");
    const { calls } = mountWith(<UdcDataView collection="messages" filter={INBOX} />);
    await waitFor(() => expect(listFilters(calls)).toContainEqual(INBOX));
    // The map loads its own rows: the paged list is not asked for at all.
    expect(listFilters(calls).every((f) => JSON.stringify(f).includes('"folder"'))).toBe(true);
  });

  it("counts in 'of M' and is not 'the user filtered' for the empty state", async () => {
    const { calls } = mountWith(<UdcDataView collection="messages" filter={INBOX} />, {
      rows: [],
    });
    expect(await screen.findByTestId("table-empty")).toBeInTheDocument();
    expect(listFilters(calls)).toContainEqual(INBOX);
    // An unfiltered empty list: no "Clear filters" to offer.
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
    expect(screen.getByTestId("row-count")).toHaveAttribute("data-total", "0");
  });

  it("a new but equal filter object each render asks once", async () => {
    const { calls, rerender } = mountWith(
      <UdcDataView collection="messages" filter={{ ...INBOX }} />,
    );
    await screen.findByTestId("udc-table");
    await waitFor(() => expect(listFilters(calls)).toHaveLength(1));
    rerender(<UdcDataView collection="messages" filter={{ ...INBOX }} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(listFilters(calls)).toHaveLength(1);
  });
});

/** What of the frame is drawn, by test id. */
function parts() {
  const frame = screen.getByTestId("data-view-frame");
  return {
    title: screen.queryByTestId("data-view-title") !== null,
    tabs: screen.queryByTestId("tab-cards") !== null,
    toggle: screen.queryByTestId("paging-toggle") !== null,
    doc: screen.queryByTestId("tab-doc") !== null,
    source: screen.queryByTestId("tab-source") !== null,
    frame: frame.className.includes("udc:rounded-xl") && frame.className.includes("udc:mx-6"),
    toolbar: screen.queryByTestId("toolbar") !== null,
    rows: screen.queryByTestId("udc-table") !== null,
  };
}

const ALL = {
  title: true,
  tabs: true,
  toggle: true,
  doc: true,
  source: true,
  frame: true,
  toolbar: true,
  rows: true,
};

describe("chrome", () => {
  it("without the prop every part is drawn, as before", async () => {
    mountWith(<UdcDataView collection="messages" />);
    await screen.findByTestId("udc-table");
    expect(parts()).toEqual(ALL);
    expect(screen.getByTestId("data-view-frame")).toHaveAttribute("data-framed", "true");
  });

  it.each([
    ["header", { title: false }],
    ["tabs", { tabs: false }],
    ["pagingToggle", { toggle: false }],
    ["docTab", { doc: false }],
    ["sourceTab", { source: false }],
    ["frame", { frame: false }],
  ] as const)("%s: false removes its part and nothing else", async (flag, gone) => {
    mountWith(<UdcDataView collection="messages" chrome={{ [flag]: false }} />);
    await screen.findByTestId("udc-table");
    expect(parts()).toEqual({ ...ALL, ...gone });
  });

  it("without the renderer tabs, Doc and Source still offer a way back to the renderer in use", async () => {
    at("/?tab=cards");
    mountWith(<UdcDataView collection="messages" chrome={{ tabs: false }} />);
    await screen.findAllByTestId("card");
    expect(screen.getByTestId("tab-cards")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-table")).toBeNull();
    expect(screen.queryByTestId("tab-map")).toBeNull();
    fireEvent.click(screen.getByTestId("tab-doc"));
    expect(await screen.findByText("Every message of the mailbox.")).toBeInTheDocument();
    // On the Doc page the way back is the view's default renderer.
    expect(screen.getByTestId("tab-table")).toBeInTheDocument();
  });

  it('"embedded" draws none of the frame; the toolbar and rows stay', async () => {
    mountWith(<UdcDataView collection="messages" chrome="embedded" />);
    await screen.findByTestId("udc-table");
    expect(parts()).toEqual({
      title: false,
      tabs: false,
      toggle: false,
      doc: false,
      source: false,
      frame: false,
      toolbar: true,
      rows: true,
    });
    // Nothing of the header is left behind.
    expect(screen.getByTestId("data-view").querySelector("header")).toBeNull();
  });

  it("a preset plus flags: the flags win", async () => {
    mountWith(<UdcDataView collection="messages" chrome={{ preset: "embedded", tabs: true }} />);
    await screen.findByTestId("udc-table");
    expect(parts()).toEqual({
      ...ALL,
      title: false,
      toggle: false,
      doc: false,
      source: false,
      frame: false,
    });
    expect(screen.getByTestId("tab-table")).toBeInTheDocument();
  });

  it("resolveChrome fills every flag from the preset", () => {
    expect(resolveChrome(undefined)).toEqual({
      header: true,
      tabs: true,
      pagingToggle: true,
      docTab: true,
      sourceTab: true,
      frame: true,
      toolbar: true,
      search: true,
      chips: true,
      filterBuilder: true,
      freshness: true,
      count: true,
    });
    // The toolbar is not part of the frame: "embedded" keeps it unless told otherwise.
    expect(resolveChrome("embedded")).toEqual({
      header: false,
      tabs: false,
      pagingToggle: false,
      docTab: false,
      sourceTab: false,
      frame: false,
      toolbar: true,
      search: true,
      chips: true,
      filterBuilder: true,
      freshness: true,
      count: true,
    });
    expect(resolveChrome({ frame: false }).header).toBe(true);
    // Without the toolbar none of its controls is drawn, whatever their own flags say.
    expect(resolveChrome({ toolbar: false, search: true })).toMatchObject({
      toolbar: false,
      search: false,
      chips: false,
      filterBuilder: false,
      freshness: false,
      count: false,
    });
  });
});

/** Which controls of the toolbar are drawn, by test id. */
function toolbarParts() {
  return {
    toolbar: screen.queryByTestId("toolbar") !== null,
    search: screen.queryByTestId("search-input") !== null,
    chips: screen.queryByTestId("filter-chips") !== null,
    filterBuilder: screen.queryByTestId("fb-open") !== null,
    freshness: screen.queryByTestId("updated-ago") !== null,
    count: screen.queryByTestId("row-count") !== null,
  };
}

const FETCHED = { fetchedAt: new Date().toISOString() };

const TOOLBAR_ALL = {
  toolbar: true,
  search: true,
  chips: true,
  filterBuilder: true,
  freshness: true,
  count: true,
};

describe("chrome: the toolbar", () => {
  it("every control is drawn by default, in either preset", async () => {
    const { unmount } = mountWith(<UdcDataView collection="messages" />, FETCHED);
    await screen.findByTestId("udc-table");
    await screen.findByTestId("updated-ago");
    expect(toolbarParts()).toEqual(TOOLBAR_ALL);
    unmount();
    mountWith(<UdcDataView collection="messages" chrome="embedded" />, FETCHED);
    await screen.findByTestId("udc-table");
    await screen.findByTestId("updated-ago");
    expect(toolbarParts()).toEqual(TOOLBAR_ALL);
  });

  it.each([
    ["search", { search: false }],
    ["chips", { chips: false }],
    ["filterBuilder", { filterBuilder: false }],
    ["freshness", { freshness: false }],
    ["count", { count: false }],
  ] as const)("%s: false removes that control and nothing else", async (flag, gone) => {
    mountWith(<UdcDataView collection="messages" chrome={{ [flag]: false }} />, FETCHED);
    await screen.findByTestId("udc-table");
    // Freshness shows once the rows have a fetch time; wait for it unless it is the one removed.
    if (flag !== "freshness") await screen.findByTestId("updated-ago");
    else
      await waitFor(() =>
        expect(screen.getByTestId("row-count")).toHaveAttribute("data-total", "5"),
      );
    expect(toolbarParts()).toEqual({ ...TOOLBAR_ALL, ...gone });
  });

  it("toolbar: false leaves no toolbar element at all, the host's slots included; the rows stay", async () => {
    mountWith(
      <UdcDataView
        collection="messages"
        chrome={{ preset: "embedded", toolbar: false }}
        toolbarStart={<button type="button">Compose</button>}
        toolbarEnd={<button type="button">Refresh</button>}
      />,
      FETCHED,
    );
    await screen.findByTestId("udc-table");
    expect(toolbarParts()).toEqual({
      toolbar: false,
      search: false,
      chips: false,
      filterBuilder: false,
      freshness: false,
      count: false,
    });
    expect(screen.queryByTestId("toolbar-start")).toBeNull();
    expect(screen.queryByTestId("toolbar-end")).toBeNull();
    expect(screen.queryByRole("button", { name: "Compose" })).toBeNull();
    expect(screen.getByTestId("data-view").querySelector(".udc-toolbar")).toBeNull();
    expect(await screen.findAllByTestId("row")).toHaveLength(2);
  });

  it("toolbar: false still shows the pills of a filter in the URL, which clear as before", async () => {
    at(`/?f=${encodeFilterParam(SUBJECT)}`);
    const { calls } = mountWith(
      <UdcDataView collection="messages" filter={INBOX} chrome={{ toolbar: false }} />,
    );
    await screen.findByTestId("udc-table");
    await waitFor(() => expect(listFilters(calls)).toContainEqual({ and: [INBOX, SUBJECT] }));
    expect(screen.getByTestId("fb-pill-0")).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByTestId("filter-pills")).getByRole("button", { name: "Clear" }),
    );
    await waitFor(() => expect(screen.queryByTestId("filter-pills")).toBeNull());
  });

  it("toolbar: false on the Doc page: the README still shows", async () => {
    mountWith(<UdcDataView collection="messages" chrome={{ toolbar: false }} />);
    await screen.findByTestId("udc-table");
    fireEvent.click(screen.getByTestId("tab-doc"));
    expect(await screen.findByText("Every message of the mailbox.")).toBeInTheDocument();
    expect(screen.queryByTestId("toolbar")).toBeNull();
  });
});

describe("the paging mode without the toggle", () => {
  it("with the toggle, the stored choice of an earlier session wins over the view (as before)", async () => {
    localStorage.setItem(pagingStorageKey("messages"), "infinite");
    mountWith(<UdcDataView collection="messages" />);
    await screen.findByTestId("udc-table");
    expect(screen.getByTestId("paging-infinite")).toHaveAttribute("data-state", "on");
    expect(screen.queryByTestId("pager")).toBeNull();
  });

  it("without it, the view's pagination: the stored choice and ?mode= are ignored", async () => {
    localStorage.setItem(pagingStorageKey("messages"), "infinite");
    at("/?mode=infinite");
    mountWith(<UdcDataView collection="messages" chrome={{ pagingToggle: false }} />);
    await screen.findByTestId("udc-table");
    expect(await screen.findByTestId("pager")).toBeInTheDocument();
  });

  it("without it, the pagingMode prop when given", async () => {
    mountWith(
      <UdcDataView collection="messages" chrome={{ pagingToggle: false }} pagingMode="infinite" />,
    );
    await screen.findByTestId("udc-table");
    expect(screen.queryByTestId("pager")).toBeNull();
  });
});

describe("toolbar slots", () => {
  it("render the host's content at the start and the end of the toolbar", async () => {
    mountWith(
      <UdcDataView
        collection="messages"
        toolbarStart={<button type="button">Compose</button>}
        toolbarEnd={<button type="button">Refresh</button>}
      />,
    );
    await screen.findByTestId("udc-table");
    const toolbar = screen.getByTestId("toolbar");
    expect(toolbar.firstElementChild).toBe(screen.getByTestId("toolbar-start"));
    expect(toolbar.lastElementChild).toBe(screen.getByTestId("toolbar-end"));
    expect(within(toolbar).getByRole("button", { name: "Compose" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    // Search, chips and the count are still there, between the slots.
    expect(within(toolbar).getByTestId("search-input")).toBeInTheDocument();
    expect(within(toolbar).getByTestId("row-count")).toBeInTheDocument();
  });

  it("draw nothing when not given", async () => {
    mountWith(<UdcDataView collection="messages" />);
    await screen.findByTestId("udc-table");
    expect(screen.queryByTestId("toolbar-start")).toBeNull();
    expect(screen.queryByTestId("toolbar-end")).toBeNull();
  });
});
