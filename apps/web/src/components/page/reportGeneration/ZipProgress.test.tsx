import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { createTestI18n } from "@/test/i18n";
import { ZipProgress } from "./ZipProgress";

const renderProgress = async (done: number, total: number, onCancel = vi.fn()) => {
  const i18n = await createTestI18n("es");
  render(
    <I18nextProvider i18n={i18n}>
      <ZipProgress done={done} total={total} onCancel={onCancel} />
    </I18nextProvider>
  );
  return onCancel;
};

describe("ZipProgress", () => {
  it("shows the farms done and the percentage", async () => {
    await renderProgress(340, 979);

    expect(screen.getByText("Generando el ZIP")).toBeTruthy();
    expect(screen.getByText("34%")).toBeTruthy(); // floor(340 / 979)
    expect(screen.getByText("340 de 979 fincas")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("34");
  });

  it("starts at 0% and never divides by zero", async () => {
    await renderProgress(0, 0);
    expect(screen.getByText("0%")).toBeTruthy();
  });

  it("cancels the job", async () => {
    const onCancel = await renderProgress(10, 100);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
