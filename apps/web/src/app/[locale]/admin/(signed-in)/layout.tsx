import { AdminShell } from "@/components/page/admin/AdminShell";

// The signed-in admin pages: the sidebar and the session check. The login, at
// `/admin`, is outside this group and has neither.
export default function AdminSignedInLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
