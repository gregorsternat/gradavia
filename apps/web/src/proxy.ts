import { NextResponse, type NextRequest } from "next/server";
import { canonicalHref } from "./features/workspace/domain/registry";

// Redirect before layout streaming, including nested routes with loading UI.
// Fragments are retained by native HTTP navigation; browsers do not send them.
export function proxy(request: NextRequest) {
  const target = canonicalHref(
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(new URL(target, request.url), 308);
}
export const config = {
  matcher: [
    "/modalites",
    "/budget",
    "/territoires",
    "/analyses",
    "/evolutions",
    "/decouvrir",
    "/donnees",
    "/archives",
    "/specialites/inverse",
    "/carte",
    "/apprentissage",
  ],
};
