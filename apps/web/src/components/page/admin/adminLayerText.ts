import type {
  AdminCategories,
  AdminLanguage,
  AdminLayer,
} from "@/interfaces/AdminLayer";
import { localizedText } from "@/utils/localizedText";

/** A layer's name or alias in `language`, else in the other one, else its id. */
export const adminLayerText = (
  layer: Pick<AdminLayer, "id" | "attributes">,
  key: "name" | "alias",
  language: AdminLanguage
) =>
  layer.attributes[language]?.[key] ??
  layer.attributes[language === "es" ? "en" : "es"]?.[key] ??
  `#${layer.id}`;

/** The admin's language from i18next's (Spanish unless English). */
export const adminLanguage = (language: string): AdminLanguage =>
  language.startsWith("en") ? "en" : "es";

/** A category's name in `language`, or its raw id when the list doesn't have it. */
export const categoryName = (
  categories: AdminCategories | null,
  categoryId: string,
  language: string
) => {
  const category = categories?.categories.find(({ id }) => id === categoryId);
  return category ? localizedText(category.name, language) : categoryId;
};
