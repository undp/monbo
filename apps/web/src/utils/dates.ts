import { format, isValid, parseISO } from "date-fns";
import { es, enUS } from "date-fns/locale";

// "2025-01-15" is a calendar day. `new Date` reads it as UTC midnight, which is
// still the day before west of UTC: read it as local midnight instead.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const toCalendarDate = (date: string | Date): Date => {
  if (typeof date !== "string") return date;
  return DATE_ONLY.test(date) ? parseISO(date) : new Date(date);
};

export const shortFormatDateByLanguage = (
  date: string,
  language: string
): string => {
  const dateObject = toCalendarDate(date);
  // A date typed in another format is shown as written, rather than failing the report.
  if (!isValid(dateObject)) return date;
  return format(dateObject, language === "en" ? "yyyy-MM-dd" : "dd-MM-yyyy");
};

export const longFormatDateByLanguage = (
  date: string | Date,
  language: string = "es"
): string => {
  const dateObject = toCalendarDate(date);
  const locale = language === "es" ? es : enUS;

  return format(
    dateObject,
    language === "es" ? "dd 'de' MMMM 'de' yyyy" : "MMMM do, yyyy",
    { locale }
  );
};
