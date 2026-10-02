import { RequireCountry } from "@/components/reusable/RequireCountry";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequireCountry>{children}</RequireCountry>;
}
