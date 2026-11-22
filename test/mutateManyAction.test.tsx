// useUdcMutateMany and useUdcAction (0.5.0, R1 + S3 and S4): the cache patched or pruned at
// once, put back on an error, invalidated when settled; a typed host action and one by name.
import { defineHostAction, type ListResponse } from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
  applyToListRows,
  mutateManyTouches,
  udcKeys,
  useUdcAction,
  useUdcMutateMany,
} from "../src/headless";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { type Call, listOf, mockUdcFetch, row } from "./fetchMock";

const ROWS = [
  row("a", 1, { folder: "inbox", read: false }),
  row("b", 1, { folder: "inbox", read: false }),
  row("c", 1, { folder: "sent", read: false }),
];

type Reply = { ok: unknown } | { err: unknown };

function setup(handlers: Record<string, (b: Record<string, unknown>) => Reply | Promise<Reply>>) {
  const mock = mockUdcFetch({ list: () => ({ ok: listOf(ROWS) }), ...handlers });
  const client = new UdcClient({ httpUrl: "http://api", fetch: mock.fetch });
  const qc: QueryClient = createUdcQueryClient();
  const key = udcKeys.list("messages", {
    filter: undefined,
    sort: [],
    limit: 50,
    mode: "pages",
    page: 1,
  });
  qc.setQueryData<ListResponse>(key, listOf(ROWS));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UdcProvider client={client}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </UdcProvider>
  );
  const cached = () => qc.getQueryData<ListResponse>(key);
  return { wrapper, qc, cached, calls: mock.calls as Call[] };
}

describe("the cache helpers", () => {
  it("mutateManyTouches: ids, or the filter less except_ids", () => {
    expect(
      ROWS.filter(mutateManyTouches({ op: "delete", ids: ["b"] })).map((r) => r.__meta.id),
    ).toEqual(["b"]);
    const byFilter = mutateManyTouches({
      op: "delete",
      filter: { field: "folder", op: "eq", value: "inbox" },
      except_ids: ["a"],
    });
    expect(ROWS.filter(byFilter).map((r) => r.__meta.id)).toEqual(["b"]);
    // A filter the browser cannot evaluate touches nothing.
    const odd = mutateManyTouches({ op: "delete", filter: { field: "x", op: "nope" } as never });
    expect(ROWS.filter(odd)).toEqual([]);
  });

  it("applyToListRows removes rows and counts the total down, across infinite pages", () => {
    const data = {
      pages: [listOf(ROWS.slice(0, 2), 3, "c1"), listOf(ROWS.slice(2), 3)],
      pageParams: [null, "c1"],
    };
    const next = applyToListRows(data, (r) => r.__meta.id !== "b") as typeof data;
    expect(next.pages.flatMap((p) => p.rows.map((r) => r.__meta.id))).toEqual(["b"]);
    expect(next.pages.map((p) => p.total)).toEqual([1, 1]);
  });
});

describe("useUdcMutateMany", () => {
  it("patches at once, keeps the patch on success, and invalidates the lists", async () => {
    let answer: (r: Reply) => void = () => {};
    const { wrapper, cached, qc } = setup({
      mutate_many: () => new Promise<Reply>((res) => (answer = res)),
    });
    const { result } = renderHook(() => useUdcMutateMany("messages"), { wrapper });
    let done: Promise<unknown> = Promise.resolve();
    act(() => {
      done = result.current.mutateAsync({ op: "update", ids: ["a", "c"], row: { read: true } });
    });
    await waitFor(() => expect(cached()?.rows.map((r) => r.read)).toEqual([true, false, true]));
    const key = udcKeys.lists("messages");
    answer({ ok: { updated: 2, failed: [] } });
    await expect(done).resolves.toEqual({ updated: 2, failed: [] });
    expect(
      qc
        .getQueryCache()
        .findAll({ queryKey: key })
        .every((q) => q.state.isInvalidated),
    ).toBe(true);
  });

  it("removes deleted rows at once and puts them back on an error", async () => {
    let answer: (r: Reply) => void = () => {};
    const { wrapper, cached } = setup({
      mutate_many: () => new Promise<Reply>((res) => (answer = res)),
    });
    const { result } = renderHook(() => useUdcMutateMany("messages"), { wrapper });
    let done: Promise<unknown> = Promise.resolve();
    act(() => {
      done = result.current.mutateAsync({
        op: "delete",
        filter: { field: "folder", op: "eq", value: "inbox" },
      });
    });
    await waitFor(() => expect(cached()?.rows.map((r) => r.__meta.id)).toEqual(["c"]));
    expect(cached()?.total).toBe(1);
    answer({ err: { code: "forbidden", message: "read-only" } });
    await expect(done).rejects.toThrow("read-only");
    await waitFor(() => expect(cached()?.rows.map((r) => r.__meta.id)).toEqual(["a", "b", "c"]));
    expect(cached()?.total).toBe(3);
  });

  it("sends the request as given, with the collection", async () => {
    const { wrapper, calls } = setup({
      mutate_many: () => ({ ok: { updated: 1, failed: [{ id: "z", code: "not_found" }] } }),
    });
    const { result } = renderHook(() => useUdcMutateMany("messages"), { wrapper });
    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ op: "delete", ids: ["a", "z"] });
    });
    expect(res).toEqual({ updated: 1, failed: [{ id: "z", code: "not_found" }] });
    expect(calls.find((c) => c.action === "mutate_many")?.body).toEqual({
      collection: "messages",
      op: "delete",
      ids: ["a", "z"],
    });
  });
});

const snooze = defineHostAction({
  name: "mail.snooze",
  request: z.object({ ids: z.array(z.string()), until: z.string() }),
  response: z.object({ snoozed: z.number().int() }),
});

describe("useUdcAction", () => {
  it("calls a host action by its definition, typed and parsed", async () => {
    const { wrapper, calls } = setup({ "mail.snooze": () => ({ ok: { snoozed: 2 } }) });
    const { result } = renderHook(() => useUdcAction(snooze), { wrapper });
    expectTypeOf(result.current.mutateAsync).parameter(0).toEqualTypeOf<{
      ids: string[];
      until: string;
    }>();
    let res: { snoozed: number } | undefined;
    await act(async () => {
      res = await result.current.mutateAsync({ ids: ["a", "b"], until: "2026-12-01" });
    });
    expect(res).toEqual({ snoozed: 2 });
    expect(calls.find((c) => c.action === "mail.snooze")?.body).toEqual({
      ids: ["a", "b"],
      until: "2026-12-01",
    });
  });

  it("an answer that does not match the definition's schema is an error", async () => {
    const { wrapper } = setup({ "mail.snooze": () => ({ ok: { snoozed: "two" } }) });
    const { result } = renderHook(() => useUdcAction(snooze), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ ids: [], until: "x" })).rejects.toThrow(
        /does not match its schema/,
      );
    });
  });

  it("calls an action by name, typed by the caller, and invalidates what it names", async () => {
    const { wrapper, calls, qc } = setup({ "mail.flag": () => ({ ok: { flagged: true } }) });
    const { result } = renderHook(
      () =>
        useUdcAction<{ flagged: boolean }, { id: string }>("mail.flag", {
          invalidates: ["messages"],
        }),
      { wrapper },
    );
    let res: { flagged: boolean } | undefined;
    await act(async () => {
      res = await result.current.mutateAsync({ id: "a" });
    });
    expect(res).toEqual({ flagged: true });
    expect(calls.find((c) => c.action === "mail.flag")?.body).toEqual({ id: "a" });
    const lists = qc.getQueryCache().findAll({ queryKey: udcKeys.lists("messages") });
    expect(lists.length).toBeGreaterThan(0);
    expect(lists.every((q) => q.state.isInvalidated)).toBe(true);
  });
});
