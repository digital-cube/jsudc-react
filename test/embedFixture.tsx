import {
  type DescribeResponse,
  type FilterNode,
  type Row,
  SchemaDocSchema,
  ViewConfigSchema,
} from "@jsudc/core";
import { UdcClient } from "@jsudc/core/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { RENDERERS } from "../src/all";
import { UdcI18nProvider } from "../src/i18n/i18n";
import { createUdcQueryClient, UdcProvider } from "../src/udc/provider";
import { Toaster, TooltipProvider } from "../src/ui-kit/ui";
import { type Call, listOf, mockUdcFetch, row } from "./fetchMock";

/** A mailbox: subject search, an "unread" chip, a subject filter, a README and a source file. */
export const describeMessages: DescribeResponse = {
  collection: "messages",
  capabilities: {
    mutate: false,
    subscribe: false,
    total_count: true,
    schema_edit: false,
    config_edit: false,
    reindex: false,
    tree_reparent: false,
    source_yaml: true,
    supported_filter_ops: [],
  },
  schema: SchemaDocSchema.parse({
    version: "v1",
    fields: {
      subject: { type: "string" },
      from: { type: "string" },
      folder: { type: "string" },
      read: { type: "bool" },
      lat: { type: "decimal" },
      lng: { type: "decimal" },
    },
  }),
  view: ViewConfigSchema.parse({
    available_renderers: ["table", "cards", "map"],
    columns: [{ field: "subject" }, { field: "from" }],
    card_options: { title_field: "subject" },
    map_options: { lat_field: "lat", lng_field: "lng" },
    search: { fields: ["subject"] },
    filters: [{ field: "read", kind: "bool" }],
    pagination: "pages",
    page_size_default: 2,
  }),
  docs: { en: "# Messages\n\nEvery message of the mailbox." },
  filterable: {
    fields: [
      {
        field: "subject",
        type: "string",
        ops: ["eq", "contains"],
        default_op: "contains",
        widget: "text",
      },
    ],
  },
  source_kind: "postgres_jsonb",
};

export const INBOX: FilterNode = { field: "folder", op: "eq", value: "inbox" };

export const messages: Row[] = [
  row("m1", 1, { subject: "Hello", from: "ana", folder: "inbox", lat: 44.8, lng: 20.4 }),
  row("m2", 1, { subject: "Invoice", from: "bob", folder: "inbox", lat: 45.2, lng: 19.8 }),
];

export interface MountOptions {
  rows?: Row[];
  total?: number;
}

/** Render `ui` under the providers a data view needs, with a `fetch` that records every call. */
export function mountWith(ui: ReactNode, { rows = messages, total = 5 }: MountOptions = {}) {
  const mock = mockUdcFetch({
    describe: () => ({ ok: describeMessages }),
    list: () => ({ ok: listOf(rows, rows.length === 0 ? 0 : total) }),
    source: () => ({ ok: { path: "messages/source.yaml", text: "kind: postgres_jsonb\n" } }),
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
  const utils = render(ui, { wrapper });
  return { ...utils, calls: mock.calls };
}

/** The `filter` of every `list` call so far. */
export const listFilters = (calls: Call[]) =>
  calls.filter((c) => c.action === "list").map((c) => c.body.filter);

export const at = (url: string) => window.history.replaceState(null, "", url);
