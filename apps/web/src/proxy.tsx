import { i18nRouter } from "next-i18n-router";
import i18nConfig from "./i18nConfig";
import { NextRequest, NextResponse } from "next/server";

const LOCALE_PREFIX = `(/(?:${i18nConfig.locales.join("|")}))?`;

// `/home` and `/{locale}/home`: the start page shows the three steps now, so the old
// module cards' route only keeps links working. Redirected here, before the locale
// router: a redirect in next.config.ts loops in the standalone server.
const HOME = new RegExp(`^${LOCALE_PREFIX}/home/?$`);

// Stage 2 moved from /deforestation-analysis to /territorial-analysis. Old links
// (bookmarks, shared URLs, example PDFs) get a permanent redirect to the same
// sub-path. The language prefix is kept as requested: the locale router then turns
// /es/... into /... and stores `es` in its cookie, so the language never changes.
const OLD_STAGE_2 = new RegExp(`^${LOCALE_PREFIX}/deforestation-analysis(?=/|$)(.*)$`);
const STAGE_2 = "/territorial-analysis";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const oldStage2 = pathname.match(OLD_STAGE_2);
  if (oldStage2) {
    const url = request.nextUrl.clone();
    url.pathname = `${oldStage2[1] ?? ""}${STAGE_2}${oldStage2[2]}`;
    return NextResponse.redirect(url, 308);
  }

  const home = pathname.match(HOME);
  if (home) {
    const url = request.nextUrl.clone();
    // The default locale has no prefix: /es/home goes straight to /.
    url.pathname =
      home[1] && home[1] !== `/${i18nConfig.defaultLocale}` ? home[1] : "/";
    return NextResponse.redirect(url);
  }
  return i18nRouter(request, i18nConfig);
}

// only applies this proxy to files in the app directory
export const config = {
  matcher: "/((?!api|static|.*\\..*|_next).*)",
};
