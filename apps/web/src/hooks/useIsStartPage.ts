import { usePathname } from "next/navigation";
import i18nConfig from "@/i18nConfig";

// The start page: `/`, or a locale's root (`/en`, `/es`).
const START_PAGE = new RegExp(`^/(?:(?:${i18nConfig.locales.join("|")})/?)?$`);

/** Whether the current page is the start page, which has the dark header. */
export const useIsStartPage = () => START_PAGE.test(usePathname());
