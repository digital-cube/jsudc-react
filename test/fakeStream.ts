import type { ChangeEvent } from "@jsudc/core";
import type { ChangesOptions, UdcClient } from "@jsudc/core/client";
import { act } from "@testing-library/react";

/** One call of `UdcClient.changes`, driven by the test. */
export interface FakeStream {
  collections: string[];
  closed: boolean;
  /** The server's `ready`: `reconnected` from the second time on. */
  open(reconnected?: boolean): void;
  emit(...events: ChangeEvent[]): void;
  /** The connection dropped; the client would retry (`onError`). */
  fail(): void;
  /** The server refused the stream: `changes()` rejects and does not retry. */
  refuse(err: unknown): void;
}

/** Replaces `client.changes` with streams the test opens, feeds, fails and refuses. */
export function fakeChanges(client: UdcClient) {
  const streams: FakeStream[] = [];
  const changes = (opts: ChangesOptions) =>
    new Promise<void>((resolve, reject) => {
      const s: FakeStream = {
        collections: [...opts.collections],
        closed: false,
        open: (reconnected = false) => act(() => opts.onOpen?.({ reconnected })),
        emit: (...events) =>
          act(() => {
            for (const e of events) opts.onChange(e);
          }),
        fail: () => act(() => opts.onError?.(new Error("dropped"), { attempt: 1, delayMs: 1000 })),
        refuse: (err) =>
          act(async () => {
            s.closed = true;
            reject(err);
            await Promise.resolve();
          }),
      };
      opts.signal?.addEventListener("abort", () => {
        s.closed = true;
        resolve();
      });
      streams.push(s);
    });
  (client as { changes: UdcClient["changes"] }).changes = changes;
  return {
    streams,
    /** The streams not closed yet. */
    get open() {
      return streams.filter((s) => !s.closed);
    },
    /** The last stream asked for. */
    get last() {
      const s = streams.at(-1);
      if (!s) throw new Error("no stream was opened");
      return s;
    },
  };
}
