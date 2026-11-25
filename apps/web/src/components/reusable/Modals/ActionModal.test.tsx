import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { createTestI18n } from "@/test/i18n";
import { ActionModal } from "./ActionModal";

describe("ActionModal", () => {
  it("is described by its question, and answers from its footer", async () => {
    const i18n = await createTestI18n("es");
    const onConfirm = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <ActionModal
          isOpen
          handleClose={vi.fn()}
          title="Cambiar de país reinicia el análisis"
          description="Vas a perder los datos que cargaste."
          actions={[
            { title: "Cancelar", handler: vi.fn(), variant: "outlined" },
            { title: "Empezar de nuevo", handler: onConfirm, variant: "contained" },
          ]}
        />
      </I18nextProvider>
    );

    const dialog = screen.getByRole("dialog", { name: "Cambiar de país reinicia el análisis" });
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(document.getElementById(describedBy!)?.textContent).toBe(
      "Vas a perder los datos que cargaste."
    );
    fireEvent.click(screen.getByRole("button", { name: "Empezar de nuevo" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
