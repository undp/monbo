import { Header } from "@/components/reusable/Header";
import { Toolbar } from "@mui/material";
import { notFound } from "next/navigation";
import i18nConfig from "@/i18nConfig";
import { LayoutProps } from "@/interfaces";

export default async function MainLayout({ children, params }: LayoutProps) {
  const { locale } = await params;

  if (!i18nConfig.locales.includes(locale)) {
    notFound();
  }
  return (
    <>
      <Header locale={locale} />
      <main>
        <Toolbar />
        {children}
      </main>
    </>
  );
}
