import { act, render, screen, within } from "@testing-library/react";
import { useContext, useEffect } from "react";
import { describe, expect, it } from "vitest";
import { SnackbarContext, SnackbarProvider } from "./SnackbarContext";

const OpenOnMount = () => {
  const { openSnackbar } = useContext(SnackbarContext);
  useEffect(() => {
    openSnackbar({ message: "Datos analizados correctamente", type: "success" });
  }, [openSnackbar]);
  return null;
};

describe("SnackbarProvider", () => {
  it("names each snackbar's close button with the label it gets", async () => {
    await act(async () => {
      render(
        <SnackbarProvider closeLabel="Cerrar">
          <OpenOnMount />
        </SnackbarProvider>
      );
    });

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Datos analizados correctamente")).toBeTruthy();
    // Not MUI's default "Close"
    expect(within(alert).getByRole("button", { name: "Cerrar" })).toBeTruthy();
  });
});
