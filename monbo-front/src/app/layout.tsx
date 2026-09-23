import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import theme from "@/config/theme";
import CssBaseline from "@mui/material/CssBaseline";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No `lang` here on purpose. This layout is the root of "/", which has no
  // dynamic segment, so Next never supplies a `locale` param -- the previous
  // `lang={locale}` resolved to undefined and rendered no attribute at all.
  // Setting it correctly means reading the locale from the request headers,
  // which would make this layout dynamic and de-opt every currently static
  // page; that trade-off is tracked separately rather than smuggled into a
  // dependency upgrade.
  return (
    <html>
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
