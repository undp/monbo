import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";

export const shortFormatDateByLanguage = (
  date: string,
  language: string
): string => {
  const dateObject = new Date(date);
  return format(dateObject, language === "en" ? "yyyy-MM-dd" : "dd-MM-yyyy");
};

export const longFormatDateByLanguage = (
  date: string | Date,
  language: string = "es"
): string => {
  const dateObject = new Date(date);
  const locale = language === "es" ? es : enUS;

  return format(
    dateObject,
    language === "es" ? "dd 'de' MMMM 'de' yyyy" : "MMMM do, yyyy",
    { locale }
  );
};
