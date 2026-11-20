import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { I18nextProvider } from "react-i18next";
import theme from "@/config/theme";
import { DataContext, type DataContextValue } from "@/context/DataContext";
import { createTestI18n, type TestLocale } from "./i18n";
import { makeDataContext } from "./renderWithData";

interface RenderLandingOptions {
  locale?: TestLocale;
  // The selected country at first; choosing another one really changes it.
  selectedCountry?: string | null;
  // The rest of the DataContext value (setters are spies).
  context?: Partial<DataContextValue>;
}

const CountryState = ({
  initial,
  context,
  children,
}: {
  initial: string | null;
  context: Partial<DataContextValue>;
  children: ReactNode;
}) => {
  const [selectedCountry, setSelectedCountry] = useState(initial);
  const value = useMemo(
    () => makeDataContext({ ...context, selectedCountry, setSelectedCountry }),
    [context, selectedCountry]
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

/**
 * Renders a start page component with the app's theme and translations, the
 * countries CO, CR and EC available, and a selected country held in real state.
 */
export const renderLanding = async (
  ui: ReactElement,
  { locale = "es", selectedCountry = null, context = {} }: RenderLandingOptions = {}
) => {
  const i18n = await createTestI18n(locale);
  const fullContext = {
    availableCountries: ["CO", "CR", "EC"],
    availableCountriesLoaded: true,
    ...context,
  };
  return render(
    <ThemeProvider theme={theme}>
      <I18nextProvider i18n={i18n}>
        <CountryState initial={selectedCountry} context={fullContext}>
          {ui}
        </CountryState>
      </I18nextProvider>
    </ThemeProvider>
  );
};
