import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { Button } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it, vi } from "vitest";
import theme from "@/config/theme";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { BaseModal } from "./BaseModal";

const renderModal = async (
  props: Partial<React.ComponentProps<typeof BaseModal>> = {},
  locale: TestLocale = "es"
) => {
  const i18n = await createTestI18n(locale);
  const handleClose = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <BaseModal isOpen handleClose={handleClose} title="Formato" {...props}>
          <p>Contenido</p>
        </BaseModal>
      </ThemeProvider>
    </I18nextProvider>
  );
  return { handleClose };
};

describe("BaseModal", () => {
  it.each([
    ["es", "Cerrar"],
    ["en", "Close"],
  ] as const)("names its close button in %s", async (locale, label) => {
    await renderModal({}, locale);
    expect(screen.getByRole("button", { name: label })).toBeTruthy();
  });

  it("is named by its title alone, and described by its subtitle", async () => {
    await renderModal({ subtitle: "Elige cómo descargar el reporte." });
    // The subtitle and the close button sit outside the DialogTitle, which names it
    const dialog = screen.getByRole("dialog", { name: "Formato" });
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe(
      "Elige cómo descargar el reporte."
    );
    expect(screen.getByRole("heading", { level: 2, name: "Formato" })).toBeTruthy();
  });

  it("closes from its close button", async () => {
    const { handleClose } = await renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(handleClose).toHaveBeenCalled();
  });

  it("shows its actions in a footer", async () => {
    await renderModal({ actions: <Button variant="contained">Descargar PDF</Button> });
    expect(screen.getByRole("button", { name: "Descargar PDF" })).toBeTruthy();
  });
});
