import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Toolbar } from "@mui/material";
import { notFound } from "next/navigation";
import theme from "@/config/theme";
import i18nConfig from "@/i18nConfig";
import { LayoutProps } from "@/interfaces";
import { Header } from "@/components/reusable/Header";
import DataProvider from "@/context/DataContext";
import { SnackbarProvider } from "@/context/SnackbarContext";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
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
  return (
    <html lang={locale}>
      <body className={roboto.variable}>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <SnackbarProvider>
              <DataProvider>
                <CssBaseline />
                <Header locale={locale} />
                <main>
                  <Toolbar />
                  {children}
                </main>
              </DataProvider>
            </SnackbarProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
