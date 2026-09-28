import { notFound } from "next/navigation";
import { AdminLayerEditorPageContent } from "@/components/page/admin/AdminLayerEditorPageContent";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function AdminEditLayerPage({ params }: Props) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  return <AdminLayerEditorPageContent layerId={Number(id)} />;
}
