import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { type Messages, UdcI18nProvider } from "../src/i18n/i18n";
import { EmptyState } from "../src/table/states";

const MAIL: Messages = {
  TBL_MAIL_MESSAGES: {
    EMPTY_TITLE: { en: "Empty folder", sr: "Prazan folder" },
    EMPTY_PLAIN: { en: "No messages here.", sr: "Ovde nema poruka." },
    EMPTY_BODY: { en: "No message matches.", sr: "Nijedna poruka ne odgovara." },
  },
};

function mount(ui: ReactNode, locale: "en" | "sr" = "en") {
  return render(
    <UdcI18nProvider messages={MAIL} locale={locale}>
      {ui}
    </UdcI18nProvider>,
  );
}

describe("EmptyState's strings", () => {
  it("come from TBL_<COLLECTION> first, in the current locale", () => {
    mount(<EmptyState filtered={false} onClear={() => {}} collection="mail_messages" />, "sr");
    const empty = screen.getByTestId("table-empty");
    expect(empty).toHaveTextContent("Prazan folder");
    expect(empty).toHaveTextContent("Ovde nema poruka.");
  });

  it("filtered: the section's EMPTY_BODY, and Clear all filters stays the app's", () => {
    mount(<EmptyState filtered onClear={() => {}} collection="mail_messages" />);
    const empty = screen.getByTestId("table-empty");
    expect(empty).toHaveTextContent("Empty folder");
    expect(empty).toHaveTextContent("No message matches.");
    expect(screen.getByRole("button", { name: "Clear all filters" })).toBeInTheDocument();
  });

  it("another collection of the same app keeps APP's wording", () => {
    mount(<EmptyState filtered={false} onClear={() => {}} collection="users" />);
    const empty = screen.getByTestId("table-empty");
    expect(empty).toHaveTextContent("Nothing matches");
    expect(empty).toHaveTextContent("This collection has no rows yet.");
  });

  it("no collection: APP, as before", () => {
    mount(<EmptyState filtered={false} onClear={() => {}} />);
    expect(screen.getByTestId("table-empty")).toHaveTextContent("This collection has no rows yet.");
  });

  it("a view's empty_label (body) still wins over the section", () => {
    mount(
      <EmptyState
        filtered={false}
        onClear={() => {}}
        collection="mail_messages"
        body="Nothing to chart."
      />,
    );
    const empty = screen.getByTestId("table-empty");
    expect(empty).toHaveTextContent("Nothing to chart.");
    expect(empty).not.toHaveTextContent("No messages here.");
  });
});
