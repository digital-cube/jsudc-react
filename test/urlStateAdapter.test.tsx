import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDataViewState } from "../src/data-view/useDataViewState";
import { UdcReactRouterUrlState } from "../src/react-router";
import {
  UdcUrlStateProvider,
  type UrlStateAdapter,
  useUrlSearchParams,
  windowLocationAdapter,
} from "../src/url-state";

const at = (url: string) => window.history.replaceState(null, "", url);

const withParam = (key: string, value: string) => (p: URLSearchParams) => {
  p.set(key, value);
  return p;
};

beforeEach(() => at("/"));

describe("windowLocationAdapter", () => {
  it("reads and writes the query string, keeping the path and the hash", () => {
    at("/udc/c?a=1#top");
    expect(windowLocationAdapter.get().get("a")).toBe("1");
    windowLocationAdapter.set(new URLSearchParams({ a: "2", b: "x y" }), { replace: true });
    expect(window.location.pathname).toBe("/udc/c");
    expect(window.location.search).toBe("?a=2&b=x+y");
    expect(window.location.hash).toBe("#top");
    windowLocationAdapter.set(new URLSearchParams());
    expect(window.location.href).toBe("http://localhost:3000/udc/c#top");
  });

  it("replace rewrites the history entry, push adds one", () => {
    const start = window.history.length;
    windowLocationAdapter.set(new URLSearchParams({ q: "a" }), { replace: true });
    expect(window.history.length).toBe(start);
    windowLocationAdapter.set(new URLSearchParams({ q: "b" }));
    expect(window.history.length).toBe(start + 1);
  });

  it("a replace keeps history.state, for the router that keyed the entry", () => {
    window.history.replaceState({ key: "k1" }, "", "/x");
    windowLocationAdapter.set(new URLSearchParams({ q: "a" }), { replace: true });
    expect(window.history.state).toEqual({ key: "k1" });
  });

  it("notifies subscribers on set and on popstate, and stops after unsubscribe", () => {
    const listener = vi.fn();
    const off = windowLocationAdapter.subscribe(listener);
    windowLocationAdapter.set(new URLSearchParams({ q: "a" }), { replace: true });
    expect(listener).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    window.dispatchEvent(new PopStateEvent("popstate"));
    windowLocationAdapter.set(new URLSearchParams({ q: "b" }), { replace: true });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("is what useUrlSearchParams uses without a provider; back re-renders it", async () => {
    at("/c?q=one");
    const { result } = renderHook(() => useUrlSearchParams());
    expect(result.current[0].get("q")).toBe("one");
    act(() => result.current[1](new URLSearchParams({ q: "two" })));
    expect(result.current[0].get("q")).toBe("two");
    expect(window.location.search).toBe("?q=two");
    act(() => window.history.back());
    await waitFor(() => expect(result.current[0].get("q")).toBe("one"));
  });
});

describe("useUrlSearchParams", () => {
  it("goes through the provider's adapter, and an updater gets the adapter's current value", () => {
    let search = "a=1";
    const set = vi.fn((next: URLSearchParams) => {
      search = next.toString();
    });
    const adapter: UrlStateAdapter = {
      get: () => new URLSearchParams(search),
      set,
      subscribe: () => () => {},
    };
    const { result } = renderHook(() => useUrlSearchParams(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <UdcUrlStateProvider adapter={adapter}>{children}</UdcUrlStateProvider>
      ),
    });
    expect(result.current[0].get("a")).toBe("1");
    const [, setParams] = result.current;
    // Two updates before any render: the second starts from the first one's result.
    setParams(withParam("b", "2"), { replace: true });
    setParams(withParam("c", "3"), { replace: true });
    expect(search).toBe("a=1&b=2&c=3");
    expect(set).toHaveBeenLastCalledWith(expect.any(URLSearchParams), { replace: true });
  });
});

type UrlApi = ReturnType<typeof useUrlSearchParams>;

function Probe({ onApi }: { onApi: (api: UrlApi) => void }) {
  onApi(useUrlSearchParams());
  return <span data-testid="search">{useLocation().search}</span>;
}

describe("UdcReactRouterUrlState", () => {
  it("reads and writes the router's location, not window.location", () => {
    let api: UrlApi | null = null;
    render(
      <MemoryRouter initialEntries={["/udc/c?tab=table"]}>
        <UdcReactRouterUrlState>
          <Probe
            onApi={(a) => {
              api = a;
            }}
          />
        </UdcReactRouterUrlState>
      </MemoryRouter>,
    );
    const current = () => api as unknown as UrlApi;
    expect(current()[0].get("tab")).toBe("table");
    act(() => {
      current()[1](withParam("q", "a"), { replace: true });
      current()[1](withParam("p", "2"), { replace: true });
    });
    expect(screen.getByTestId("search").textContent).toBe("?tab=table&q=a&p=2");
    expect(current()[0].get("p")).toBe("2");
    expect(window.location.search).toBe("");
  });
});

describe("the data view without a router", () => {
  it("keeps its state in window.location, replacing the entry, and reads it back", () => {
    at("/udc/c?tab=cards&p=3&mode=pages");
    const start = window.history.length;
    const first = renderHook(() => useDataViewState("c", undefined));
    expect(first.result.current.page).toBe(3);
    act(() => first.result.current.setSearch("acme"));
    // A new search drops the page, and is not a history entry.
    expect(window.location.search).toBe("?tab=cards&mode=pages&q=acme");
    expect(window.history.length).toBe(start);
    expect(first.result.current.search).toBe("acme");
    expect(first.result.current.page).toBe(1);
    first.unmount();
    // As after a reload: a fresh mount reads the address bar.
    const again = renderHook(() => useDataViewState("c", undefined));
    expect(again.result.current.search).toBe("acme");
  });
});
