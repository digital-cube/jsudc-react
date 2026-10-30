import { describe, expect, it } from "vitest";
import { cn } from "../src/lib/utils";

describe("cn", () => {
  it("merges udc:-prefixed utilities of one group, the later one wins", () => {
    expect(cn("udc:px-2 udc:py-1", "udc:px-3")).toBe("udc:py-1 udc:px-3");
    expect(cn("udc:hover:bg-hover", "udc:hover:bg-selected")).toBe("udc:hover:bg-selected");
  });

  it("keeps the stable udc-* classes and a host's own classes", () => {
    expect(cn("udc-table udc:flex", "my-grid")).toBe("udc-table udc:flex my-grid");
  });
});
