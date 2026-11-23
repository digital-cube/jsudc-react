import { type DescribeResponse, sourceGroup } from "@jsudc/core";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UdcDataView } from "../src/data-view/UdcDataView";
import { describeMessages, messages, mountWith } from "./embedFixture";

/** The mailbox fixture served from a SQLite table (@jsudc/core 0.7.0). */
const describeSqlite: DescribeResponse = {
  ...describeMessages,
  capabilities: { ...describeMessages.capabilities, source_yaml: false },
  source_kind: "sqlite_table",
};

describe("a sqlite_table collection", () => {
  it("is a database source, in the sidebar's database group", () => {
    expect(sourceGroup("sqlite_table")).toBe("database");
  });

  it("parses from describe and draws its rows like any other table", async () => {
    mountWith(<UdcDataView collection="messages" />, {
      rows: messages,
      total: messages.length,
      describe: describeSqlite,
    });
    expect(await screen.findByText("Hello")).toBeTruthy();
    expect(screen.getByText("Invoice")).toBeTruthy();
  });
});
