import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import theme from "@/config/theme";
import CssBaseline from "@mui/material/CssBaseline";
import i18nConfig from "@/i18nConfig";
import { LayoutProps } from "@/interfaces";
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

export function generateStaticParams() {
  return i18nConfig.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  return (
    <html lang={locale}>
      <body className={roboto.variable}>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <SnackbarProvider>
              <DataProvider>
                <CssBaseline />
                {children}
              </DataProvider>
            </SnackbarProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
