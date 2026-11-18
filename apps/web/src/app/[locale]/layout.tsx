import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Roboto } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { notFound } from "next/navigation";
import theme from "@/config/theme";
import i18nConfig from "@/i18nConfig";
import initTranslations from "@/utils/i18n";
import { LayoutProps } from "@/interfaces";
import { Header } from "@/components/reusable/Header";
import { HeaderSpacer } from "@/components/reusable/Header/HeaderSpacer";
import DataProvider from "@/context/DataContext";
import { SnackbarProvider } from "@/context/SnackbarContext";
import { AdminSessionProvider } from "@/context/AdminSessionContext";
import { RuntimeConfigBoundary } from "@/components/reusable/RuntimeConfigBoundary";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

// Headings of the start page and the header brand (mockup v2). Other units reuse
// `--font-heading`; next/font serves the files from the app, not from Google.
const plusJakartaSans = Plus_Jakarta_Sans({
  weight: ["700", "800"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Monbo",
  description: "",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

// This is the application's root layout: every page lives under `[locale]`, so
// `<html>` belongs here rather than one level up. That is what lets `lang` be
// set correctly -- `locale` is this segment's dynamic param, so it is known at
// build time and the pages stay prerendered. A root layout above this one could
// only reach the locale through request headers, which would make every page
// dynamic.
export function generateStaticParams() {
  return i18nConfig.locales.map((locale) => ({ locale }));
}

export default async function MainLayout({ children, params }: LayoutProps) {
  const { locale } = await params;

  if (!i18nConfig.locales.includes(locale)) {
    notFound();
  }
  // The snackbars live above every page's translations (see SnackbarProvider).
  const { t } = await initTranslations(locale, ["common"]);
  return (
    <html lang={locale}>
      <body className={`${roboto.variable} ${plusJakartaSans.variable}`}>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <SnackbarProvider closeLabel={t("common:close")}>
              <DataProvider locale={locale}>
                {/* Here rather than in the admin layout: the header shows the
                    admin session's country. */}
                <AdminSessionProvider locale={locale}>
                  <CssBaseline />
                  <Header locale={locale} />
                  <main>
                    <HeaderSpacer />
                    {/* The pages render once the API's settings (thresholds) load. */}
                    <RuntimeConfigBoundary locale={locale}>
                      {children}
                    </RuntimeConfigBoundary>
                  </main>
                </AdminSessionProvider>
              </DataProvider>
            </SnackbarProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
