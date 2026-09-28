import type { Metadata } from "next";
import TranslationsProvider from "@/context/TranslationProvider";
import { AdminSessionProvider } from "@/context/AdminSessionContext";
import { LayoutProps } from "@/interfaces";
import initTranslations from "@/utils/i18n";

const namespaces = ["common", "admin"];

// Not linked from the public pages, and kept out of search engines.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  const { resources } = await initTranslations(locale, namespaces);

  return (
    <TranslationsProvider
      locale={locale}
      namespaces={namespaces}
      resources={resources}
    >
      <AdminSessionProvider>{children}</AdminSessionProvider>
    </TranslationsProvider>
  );
}
