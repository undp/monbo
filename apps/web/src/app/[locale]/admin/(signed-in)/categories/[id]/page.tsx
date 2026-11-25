import { notFound } from "next/navigation";
import { AdminCategoryEditorPageContent } from "@/components/page/admin/AdminCategoryEditorPageContent";
import { CATEGORY_ID_PATTERN } from "@/components/page/admin/categoryFormState";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function AdminEditCategoryPage({ params }: Props) {
  const { id } = await params;
  // Not an id the API could have given a category
  if (!CATEGORY_ID_PATTERN.test(id)) notFound();

  return <AdminCategoryEditorPageContent categoryId={id} />;
}
