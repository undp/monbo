import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import type { DocumentationContent } from "@/utils/documentation";
import { MethodologyDocument } from "./MethodologyDocument";

const section = (title: string, body = "") =>
  `## ${title}\n\n:::summary\n- The point of ${title}.\n:::\n\n${body}`;

const CONTENT: DocumentationContent = {
  upload: section("Upload"),
  validation: section("Validation"),
  area: section("Area"),
  deforestation: section(
    "Deforestation",
    "Visible text at 10:30.\n\n:::details[More detail: the formula]\nAbove {{deforestationThreshold}}, step by step.\n:::\n"
  ),
};

const renderDocument = async (locale: TestLocale = "es") => {
  setRuntimeConfig({
    overlapThresholdPercentage: 1,
    deforestationThresholdPercentage: 2,
  });
  const i18n = await createTestI18n(locale);
  render(
    <I18nextProvider i18n={i18n}>
      <MethodologyDocument content={CONTENT} />
    </I18nextProvider>
  );
};

describe("MethodologyDocument", () => {
  it("lists the four sections in the index, in order", async () => {
    await renderDocument();

    const index = screen.getByRole("navigation");
    const links = [...index.querySelectorAll("a")].map((a) => [
      a.textContent,
      a.getAttribute("href"),
    ]);
    expect(links).toEqual([
      ["Upload", "#upload"],
      ["Validation", "#validation"],
      ["Area", "#area"],
      ["Deforestation", "#deforestation"],
    ]);
  });

  it("titles each summary in the page's language", async () => {
    await renderDocument("es");
    expect(screen.getAllByText("En resumen")).toHaveLength(4);
  });

  it("titles the summaries in English", async () => {
    await renderDocument("en");
    expect(screen.getAllByText("In short")).toHaveLength(4);
  });

  it("keeps a details block closed until it is clicked", async () => {
    await renderDocument();

    const toggle = screen.getByRole("button", { name: "More detail: the formula" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("opens a details block from the keyboard", async () => {
    await renderDocument();

    // A native <button> in the tab order: the browser turns Enter and Space into
    // a click (jsdom doesn't, so the app run checks the keys themselves).
    const toggle = screen.getByRole("button", { name: "More detail: the formula" });
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.getAttribute("tabindex")).not.toBe("-1");
    toggle.focus();
    expect(document.activeElement).toBe(toggle);
  });

  it("fills in a threshold inside a details block", async () => {
    await renderDocument("en");
    expect(screen.getByText("Above 2%, step by step.", { exact: false })).toBeTruthy();
  });

  it("keeps text that looks like a directive", async () => {
    await renderDocument();
    expect(screen.getByText("Visible text at 10:30.")).toBeTruthy();
  });
});
