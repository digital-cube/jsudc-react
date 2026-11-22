import type { DescribeResponse, ListResponse, Row } from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { RENDERERS } from "../src/all";
import { UdcDataView } from "../src/data-view/UdcDataView";
import { UdcI18nProvider } from "../src/i18n/i18n";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { Toaster, TooltipProvider } from "../src/ui-kit/ui";
import { at, describeMessages } from "./embedFixture";
import { type Call, mockUdcFetch, row } from "./fetchMock";

/**
 * A source that does not count (`postgres_table`'s `totalCount: false`):
 * `capabilities.total_count: false` and every list answers `total: null`.
 * Pages of 2 (the fixture's `page_size_default`).
 */
const uncounted = (paging: ("cursor" | "offset")[] = ["cursor", "offset"]): DescribeResponse => ({
  ...describeMessages,
  capabilities: { ...describeMessages.capabilities, total_count: false, paging },
});

const ROWS: Row[] = ["a", "b", "c"].map((id) => row(id, 1, { subject: id, from: id }));

type Lister = (
  body: Record<string, unknown>,
) => ListResponse | { err: unknown } | Promise<ListResponse>;

/** By offset, or by cursor (the cursor is the next offset): `total: null`. */
const pageOf: Lister = (body) => {
  const page = body.page as { limit: number; offset?: number; cursor?: string };
  const start = page.offset ?? (page.cursor ? Number(page.cursor) : 0);
  const rows = ROWS.slice(start, start + page.limit);
  const end = start + rows.length;
  return { rows, total: null, next_cursor: end < ROWS.length ? String(end) : null };
};
const pageOfCounted = (body: Record<string, unknown>): ListResponse => ({
  ...(pageOf(body) as ListResponse),
  total: ROWS.length,
});

function mount(ui: ReactNode, list: Lister = pageOf, describeAs = uncounted()) {
  const mock = mockUdcFetch({
    describe: () => ({ ok: describeAs }),
    list: async (body) => {
      const res = await list(body);
      return "err" in res ? res : { ok: res };
    },
  });
  const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
  const qc = createUdcQueryClient();
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
  return { ...render(ui, { wrapper }), calls: mock.calls as Call[] };
}

const count = () => screen.getByTestId("row-count");
const offsets = (calls: Call[]) =>
  calls
    .filter((c) => c.action === "list")
    .map((c) => c.body.page as { offset?: number; cursor?: string });

afterEach(() => {
  at("/");
  window.localStorage.clear();
});

describe("a source that does not count (total_count: false)", () => {
  it("draws the count skeleton only while the first page loads", async () => {
    let release: (res: ListResponse) => void = () => {};
    mount(
      <UdcDataView collection="messages" />,
      () => new Promise<ListResponse>((r) => (release = r)),
    );
    await waitFor(() => expect(count()).toHaveAttribute("data-loading", "true"));
    release({ rows: ROWS.slice(0, 2), total: null, next_cursor: null });
    await waitFor(() => expect(count()).not.toHaveAttribute("data-loading"));
    expect(count()).not.toHaveAttribute("data-total");
  });

  it("pages mode: the range of the page, and a pager with no last page", async () => {
    const { calls } = mount(<UdcDataView collection="messages" />);
    await waitFor(() => expect(count()).toHaveTextContent("Showing 1–2"));
    expect(count()).toHaveAttribute("data-shown", "2");
    expect(count()).not.toHaveAttribute("data-loading");

    // No total, so no last page: page 1 and the next one, which a full page may hold.
    expect(screen.getByTestId("pager-status")).toHaveTextContent("Page 1");
    expect(screen.queryByTestId("pager-last")).toBeNull();
    expect(screen.getByTestId("pager-page-2")).toBeInTheDocument();
    expect(screen.queryByTestId("pager-page-3")).toBeNull();
    expect(screen.getByTestId("pager")).toHaveTextContent("1–2");
    expect(screen.getByTestId("pager")).not.toHaveTextContent(" of ");

    fireEvent.click(screen.getByTestId("pager-next"));
    await waitFor(() => expect(count()).toHaveTextContent("Showing 3–3"));
    expect(offsets(calls).at(-1)).toMatchObject({ offset: 2 });
    // A short page is the last one: no next.
    expect(screen.getByTestId("pager-status")).toHaveTextContent("Page 2");
    expect(screen.getByTestId("pager-next")).toBeDisabled();
    expect(screen.queryByTestId("pager-page-3")).toBeNull();
  });

  it("infinite mode: 'Showing N+' while there is more, 'Showing N' at the end", async () => {
    at("/?mode=infinite");
    mount(<UdcDataView collection="messages" />);
    await waitFor(() => expect(count()).toHaveTextContent(/^Showing 2\+$/));
    expect(count()).not.toHaveAttribute("data-loading");
    expect(count()).not.toHaveAttribute("data-total");
  });

  it("infinite mode, every row loaded: 'Showing N'", async () => {
    at("/?mode=infinite");
    mount(<UdcDataView collection="messages" />, () => ({
      rows: ROWS.slice(0, 2),
      total: null,
      next_cursor: null,
    }));
    await waitFor(() => expect(count()).toHaveTextContent(/^Showing 2$/));
  });

  it("infinite mode by offset only: a full page means there may be more", async () => {
    at("/?mode=infinite");
    mount(<UdcDataView collection="messages" />, pageOf, uncounted(["offset"]));
    // No cursor and no total: a full page is not the end of the list.
    await waitFor(() => expect(count()).toHaveTextContent(/^Showing 2\+$/));
    expect(screen.getByTestId("infinite-footer")).not.toHaveTextContent("All");
  });

  it("a failed first page: no count, and no skeleton", async () => {
    mount(<UdcDataView collection="messages" />, () => ({
      err: { code: "internal_error", message: "down" },
    }));
    await screen.findByTestId("retry");
    expect(count()).not.toHaveAttribute("data-loading");
    expect(count()).toHaveTextContent(/^$/);
  });
});

describe("a source that counts", () => {
  it("still reads 'Showing N of M' and pages to the last page", async () => {
    mount(<UdcDataView collection="messages" />, pageOfCounted, describeMessages);
    await waitFor(() => expect(count()).toHaveTextContent("Showing 2 of 3"));
    expect(screen.getByTestId("pager-status")).toHaveTextContent("Page 1 of 2");
    expect(screen.getByTestId("pager-last")).toBeInTheDocument();
  });
});
