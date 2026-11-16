import { i18nRouter } from "next-i18n-router";
import i18nConfig from "./i18nConfig";
import { NextRequest, NextResponse } from "next/server";

// `/home` and `/{locale}/home`: the start page shows the three steps now, so the old
// module cards' route only keeps links working. Redirected here, before the locale
// router: a redirect in next.config.ts loops in the standalone server.
const HOME = new RegExp(`^(/(?:${i18nConfig.locales.join("|")}))?/home/?$`);

export function proxy(request: NextRequest) {
  const home = request.nextUrl.pathname.match(HOME);
  if (home) {
    const url = request.nextUrl.clone();
    url.pathname = home[1] ?? "/";
    return NextResponse.redirect(url);
  }
  return i18nRouter(request, i18nConfig);
}

// only applies this proxy to files in the app directory
export const config = {
  matcher: "/((?!api|static|.*\\..*|_next).*)",
};
