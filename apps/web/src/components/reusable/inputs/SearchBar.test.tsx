import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { setSearchParams } from "@/test/navigation";
import { SearchBar } from "./SearchBar";

const renderSearch = async (locale: TestLocale) => {
  setSearchParams({ search: "Ana" });
  const i18n = await createTestI18n(locale);
  render(
    <I18nextProvider i18n={i18n}>
      <SearchBar placeholder="Buscar polígono o productor" />
    </I18nextProvider>
  );
};

describe("SearchBar", () => {
  it.each([
    ["es", "Borrar la búsqueda"],
    ["en", "Clear the search"],
  ] as const)("names its clear button in %s", async (locale, label) => {
    await renderSearch(locale);
    expect(screen.getByRole("button", { name: label })).toBeTruthy();
  });

  it("empties the field from its clear button", async () => {
    await renderSearch("es");
    fireEvent.click(screen.getByRole("button", { name: "Borrar la búsqueda" }));
    expect((screen.getByPlaceholderText("Buscar polígono o productor") as HTMLInputElement).value).toBe(
      ""
    );
  });
});
