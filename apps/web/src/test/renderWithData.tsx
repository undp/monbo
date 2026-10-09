import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { vi } from "vitest";
import { DataContext, type DataContextValue } from "@/context/DataContext";
import { createTestI18n, type TestLocale } from "./i18n";

/**
 * A complete DataContext value with nothing loaded. Every setter is a spy, so a
 * test can assert what a hook asked the provider to do.
 */
export const makeDataContext = (
  overrides: Partial<DataContextValue> = {}
): DataContextValue => ({
  farmsData: null,
  setFarmsData: vi.fn(),
  polygonsValidationResults: null,
  setPolygonsValidationResults: vi.fn(),
  deforestationAnalysisParams: { polygonsSubset: "valid", selectedMaps: [] },
  setDeforestationAnalysisParams: vi.fn(),
  deforestationAnalysisResults: null,
  setDeforestationAnalysisResults: vi.fn(),
  analysisOutdated: false,
  setAnalysisOutdated: vi.fn(),
  invalidateAnalysis: vi.fn(),
  reportGenerationParams: {
    initialFarmSelection: "all",
    selectedMaps: [],
    selectedFarms: [],
    downloadType: null,
  },
  setReportGenerationParams: vi.fn(),
  availableMaps: [],
  availableMapsError: false,
  setAvailableMaps: vi.fn(),
  availableCountries: [],
  availableCountriesLoaded: false,
  availableCountriesError: false,
  selectedCountry: null,
  setSelectedCountry: vi.fn(),
  countryHydrated: true,
  resetAnalysis: vi.fn(),
  ...overrides,
});

interface RenderOptions<P> {
  context?: DataContextValue;
  locale?: TestLocale;
  initialProps?: P;
  /** Mounted inside the injected DataContext, e.g. a provider that reads it. */
  wrapper?: (props: { children: ReactNode }) => ReactNode;
}

/**
 * Renders a hook under an injected DataContext (not the real DataProvider) and the
 * app's real translations. `setContext` swaps the value; call `rerender` after it.
 */
export const renderHookWithData = async <R, P = undefined>(
  hook: (props: P) => R,
  {
    context = makeDataContext(),
    locale = "es",
    initialProps,
    wrapper: Inner = ({ children }) => children,
  }: RenderOptions<P> = {}
) => {
  const i18n = await createTestI18n(locale);
  let current = context;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider value={current}>
        <Inner>{children}</Inner>
      </DataContext.Provider>
    </I18nextProvider>
  );
  const rendered = renderHook(hook, { wrapper, initialProps: initialProps as P });
  return {
    ...rendered,
    get context() {
      return current;
    },
    setContext: (next: DataContextValue) => {
      current = next;
    },
  };
};
