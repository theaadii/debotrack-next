import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap first gate: no session cookie → go to the sign-in page. This only checks that a cookie exists;
 * every page and action still verifies the session against the database (see lib/auth.ts).
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("dt_session")) {
    // Programs calling an API want a status code, not a redirect to a web page.
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|forgot-password|reset-password|_next/static|_next/image|brand|icon.png|favicon.ico).*)"],
};
