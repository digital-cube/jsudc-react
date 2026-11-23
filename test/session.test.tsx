import { isUnauthenticated, UdcError } from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { type QueryClient, QueryClientProvider, useQueries } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { RENDERERS } from "../src/all";
import { UdcDataView } from "../src/data-view/UdcDataView";
import { UdcI18nProvider } from "../src/i18n/i18n";
import { ErrorState } from "../src/table/states";
import { useUdcDescribe, useUdcMutate } from "../src/udc/hooks";
import { createUdcQueryClient, shouldRetry, UdcProvider } from "../src/udc/provider";
import { stubKit } from "./stubKit";

type Refusal = "http401" | "envelope";

/** A `fetch` that refuses every call as "not signed in": an HTTP 401, or the in-protocol `.err`. */
function refusingFetch(how: Refusal) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    if (how === "http401") return new Response("unauthorized", { status: 401 });
    const action = String(input).split("/udc/")[1] ?? "";
    const envelope = {
      kind: `udc.${action}.err`,
      id: "",
      payload: {
        code: "forbidden",
        message: "not signed in",
        details: { reason: "unauthenticated" },
      },
    };
    return new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  return fetch;
}

function setup(how: Refusal, qc: QueryClient = createUdcQueryClient(), kit?: typeof stubKit) {
  const fetch = refusingFetch(how);
  const client = new UdcClient({
    httpUrl: "http://api",
    fetch: fetch as unknown as typeof globalThis.fetch,
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UdcProvider client={client} renderers={RENDERERS} {...(kit ? { kit } : {})}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </UdcProvider>
  );
  return { fetch, qc, wrapper };
}

describe.each<Refusal>(["http401", "envelope"])("not signed in (%s)", (how) => {
  it("is asked once, not retried, and fails as unauthenticated", async () => {
    const { fetch, wrapper } = setup(how);
    const { result } = renderHook(() => useUdcDescribe("companies"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeInstanceOf(UdcError);
    expect(isUnauthenticated(result.current.error)).toBe(true);
  });

  it("calls onUnauthenticated once when three queries fail together", async () => {
    const onUnauthenticated = vi.fn();
    const { fetch, wrapper } = setup(how, createUdcQueryClient({ onUnauthenticated }));
    const { result } = renderHook(
      () => [useUdcDescribe("a"), useUdcDescribe("b"), useUdcDescribe("c")],
      { wrapper },
    );
    await waitFor(() => expect(result.current.every((q) => q.isError)).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(isUnauthenticated(onUnauthenticated.mock.calls[0]?.[0])).toBe(true);
  });

  it("calls onUnauthenticated for a mutation", async () => {
    const onUnauthenticated = vi.fn();
    const { wrapper } = setup(how, createUdcQueryClient({ onUnauthenticated }));
    const { result } = renderHook(() => useUdcMutate("companies"), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({ op: "delete", id: "x", version: 1 } as never)
        .catch(() => {});
    });
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it("renders the signed-out state, without Retry, in the data view", async () => {
    window.history.replaceState(null, "", "/");
    const { wrapper } = setup(how, createUdcQueryClient(), stubKit);
    render(
      <UdcI18nProvider locale="en">
        <stubKit.TooltipProvider>
          <stubKit.Toaster>
            <UdcDataView collection="companies" />
          </stubKit.Toaster>
        </stubKit.TooltipProvider>
      </UdcI18nProvider>,
      { wrapper },
    );
    const panel = await screen.findByTestId("signed-out");
    expect(panel.textContent).toContain("You are signed out");
    expect(screen.queryByTestId("table-error")).toBeNull();
    expect(screen.queryByTestId("retry")).toBeNull();
  });
});

describe("onUnauthenticated bursts", () => {
  it("fires again once the quiet time has passed", async () => {
    const onUnauthenticated = vi.fn();
    const { wrapper } = setup(
      "http401",
      createUdcQueryClient({ onUnauthenticated, unauthenticatedQuietMs: 20 }),
    );
    const { result } = renderHook(() => useUdcMutate("companies"), { wrapper });
    const fail = () =>
      act(async () => {
        await result.current
          .mutateAsync({ op: "delete", id: "x", version: 1 } as never)
          .catch(() => {});
      });
    await fail();
    await fail();
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 40));
    await fail();
    expect(onUnauthenticated).toHaveBeenCalledTimes(2);
  });

  it("is not called for other errors", async () => {
    const onUnauthenticated = vi.fn();
    const qc = createUdcQueryClient({ onUnauthenticated });
    const fetch = vi.fn(async () => new Response("no", { status: 403 }));
    const client = new UdcClient({
      httpUrl: "",
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <UdcProvider client={client}>
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      </UdcProvider>
    );
    const { result } = renderHook(
      () => useQueries({ queries: [{ queryKey: ["x"], queryFn: () => client.describe("x") }] }),
      { wrapper },
    );
    await waitFor(() => expect(result.current[0]?.isError).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(1); // a 403 is a refusal too: not retried
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });
});

describe("createUdcQueryClient and shouldRetry", () => {
  it("still takes no arguments, and still retries a transport failure twice", () => {
    expect(createUdcQueryClient()).toBeDefined();
    expect(shouldRetry(0, new Error("udc.list: HTTP 502"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(2, new Error("udc.list: HTTP 502"))).toBe(false);
    expect(
      shouldRetry(
        0,
        new UdcError("forbidden", "x", { reason: "unauthenticated", http_status: 401 }),
      ),
    ).toBe(false);
  });

  it("retries busy (another writer held the lock) twice, and no other protocol error", () => {
    expect(shouldRetry(0, new UdcError("busy", "database main is busy"))).toBe(true);
    expect(shouldRetry(1, new UdcError("busy", "database main is busy"))).toBe(true);
    expect(shouldRetry(2, new UdcError("busy", "database main is busy"))).toBe(false);
    expect(shouldRetry(0, new UdcError("internal", "boom"))).toBe(false);
  });
});

describe("ErrorState signed out", () => {
  const unauthenticated = new UdcError("forbidden", "udc.list: HTTP 401", {
    reason: "unauthenticated",
    http_status: 401,
  });

  it("speaks Serbian", () => {
    render(
      <UdcI18nProvider locale="sr">
        <ErrorState error={unauthenticated} onRetry={() => {}} />
      </UdcI18nProvider>,
    );
    expect(screen.getByTestId("signed-out").textContent).toContain("Niste prijavljeni");
  });

  it("takes the host's wording", () => {
    render(
      <UdcI18nProvider
        locale="en"
        messages={{
          APP: { SIGNED_OUT_TITLE: { en: "Session expired" }, SIGNED_OUT_BODY: { en: "Log in." } },
        }}
      >
        <ErrorState error={unauthenticated} onRetry={() => {}} />
      </UdcI18nProvider>,
    );
    const panel = screen.getByTestId("signed-out");
    expect(panel.textContent).toContain("Session expired");
    expect(panel.textContent).toContain("Log in.");
  });

  it("keeps the generic failure with Retry for a plain forbidden", () => {
    render(
      <UdcI18nProvider locale="en">
        <ErrorState error={new UdcError("forbidden", "udc.list: HTTP 403")} onRetry={() => {}} />
      </UdcI18nProvider>,
    );
    expect(screen.getByTestId("table-error")).toBeTruthy();
    expect(screen.queryByTestId("signed-out")).toBeNull();
  });
});
