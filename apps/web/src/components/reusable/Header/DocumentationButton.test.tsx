import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { setPathname } from "@/test/navigation";
import { DocumentationButton } from "./DocumentationButton";

const renderButton = async (locale: TestLocale) => {
  const i18n = await createTestI18n(locale);
  render(
    <I18nextProvider i18n={i18n}>
      <DocumentationButton />
    </I18nextProvider>
  );
};

describe("DocumentationButton", () => {
  it("links to the Spanish page, named in Spanish", async () => {
    await renderButton("es");

    const link = screen.getByRole("link", { name: "Documentación" });
    expect(link.getAttribute("href")).toBe("/documentation");
  });

  it("links to the English page, named in English", async () => {
    setPathname("/en/admin");
    await renderButton("en");

    const link = screen.getByRole("link", { name: "Documentation" });
    expect(link.getAttribute("href")).toBe("/en/documentation");
  });

  it("shows its name as a tooltip", async () => {
    await renderButton("es");

    fireEvent.mouseOver(screen.getByRole("link"));

    expect(await screen.findByRole("tooltip")).toBeTruthy();
    expect(screen.getByRole("tooltip").textContent).toBe("Documentación");
  });

  it("is marked as the current page only on the documentation page", async () => {
    setPathname("/polygons-validation");
    await renderButton("es");
    expect(screen.getByRole("link").getAttribute("aria-current")).toBeNull();
  });

  it.each([
    ["es", "/documentation"],
    ["en", "/en/documentation"],
  ] as const)("is marked as the current page on %s's documentation", async (locale, path) => {
    setPathname(path);
    await renderButton(locale);
    expect(screen.getByRole("link").getAttribute("aria-current")).toBe("page");
  });
});
