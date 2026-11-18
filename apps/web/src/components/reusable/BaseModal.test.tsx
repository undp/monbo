import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { BaseModal } from "./BaseModal";

const renderModal = async (locale: TestLocale) => {
  const i18n = await createTestI18n(locale);
  render(
    <I18nextProvider i18n={i18n}>
      <BaseModal isOpen handleClose={vi.fn()} title="Title">
        Content
      </BaseModal>
    </I18nextProvider>
  );
};

describe("BaseModal", () => {
  it.each([
    ["es", "Cerrar"],
    ["en", "Close"],
  ] as const)("names its close button in %s", async (locale, label) => {
    await renderModal(locale);
    expect(screen.getByRole("button", { name: label })).toBeTruthy();
  });
});
