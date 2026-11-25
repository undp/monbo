import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { DownloadButton } from "./DownloadButton";

const renderButton = async (locale: TestLocale, onExcel = vi.fn()) => {
  const i18n = await createTestI18n(locale);
  render(
    <I18nextProvider i18n={i18n}>
      <DownloadButton
        options={[
          { label: "Excel", onClick: onExcel },
          { label: "GeoJSON", onClick: vi.fn() },
        ]}
      />
    </I18nextProvider>
  );
  return { onExcel };
};

describe("DownloadButton", () => {
  it.each([
    ["es", "Descargar"],
    ["en", "Download"],
  ] as const)("is named by its text in %s", async (locale, label) => {
    await renderButton(locale);
    expect(screen.getByRole("button", { name: label })).toBeTruthy();
  });

  it("lists the formats and downloads the chosen one", async () => {
    const { onExcel } = await renderButton("es");
    fireEvent.click(screen.getByRole("button", { name: "Descargar" }));
    expect(screen.getByRole("menuitem", { name: "GeoJSON" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Excel" }));
    expect(onExcel).toHaveBeenCalled();
  });
});
