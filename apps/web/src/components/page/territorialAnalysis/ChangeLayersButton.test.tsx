import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { DataContext } from "@/context/DataContext";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { router } from "@/test/navigation";
import { makeDataContext } from "@/test/renderWithData";
import { ChangeLayersButton } from "./ChangeLayersButton";

const renderButton = async (locale: TestLocale) => {
  const context = makeDataContext({
    analysisDraft: { polygonsSubset: "all", selectedMapIds: [9] },
  });
  const i18n = await createTestI18n(locale);
  render(
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider value={context}>
        <ChangeLayersButton />
      </DataContext.Provider>
    </I18nextProvider>
  );
  return context;
};

describe("ChangeLayersButton", () => {
  it("goes to the selection page in the current language", async () => {
    await renderButton("en");
    fireEvent.click(screen.getByRole("button", { name: "Change layers" }));
    expect(router.push).toHaveBeenCalledWith("/en/territorial-analysis/layers");
  });

  it("starts from the analysed choices, dropping an unanalysed draft", async () => {
    const context = await renderButton("es");
    fireEvent.click(screen.getByRole("button", { name: "Cambiar capas" }));
    expect(context.setAnalysisDraft).toHaveBeenCalledWith(null);
    expect(router.push).toHaveBeenCalledWith("/territorial-analysis/layers");
  });
});
