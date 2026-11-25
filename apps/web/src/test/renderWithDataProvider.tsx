import { useContext, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import DataProvider, { DataContext } from "@/context/DataContext";
import { createTestI18n, type TestLocale } from "./i18n";

const mount = async (locale: TestLocale) => {
  const i18n = await createTestI18n(locale);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <DataProvider locale={locale}>{children}</DataProvider>
    </I18nextProvider>
  );
  return renderHook(() => useContext(DataContext), { wrapper });
};

/**
 * Mounts the real DataProvider (it fetches /countries at once: mock @/api/countries
 * first) and reads its context value. `remount` unmounts it and mounts a new one,
 * as a language change does.
 */
export const renderWithDataProvider = async (locale: TestLocale = "es") => {
  let rendered = await mount(locale);
  return {
    get result() {
      return rendered.result;
    },
    unmount: () => rendered.unmount(),
    remount: async (next: TestLocale = locale) => {
      rendered.unmount();
      rendered = await mount(next);
    },
  };
};
