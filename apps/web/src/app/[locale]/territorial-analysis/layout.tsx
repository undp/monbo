import { RequireCountry } from "@/components/reusable/RequireCountry";
import { FlowLayout } from "@/components/page/flow/FlowLayout";
import { LayoutProps } from "@/interfaces";

export default async function Layout({ children, params }: LayoutProps) {
  const { locale } = await params;
  return (
    <RequireCountry>
      <FlowLayout locale={locale}>{children}</FlowLayout>
    </RequireCountry>
  );
}
