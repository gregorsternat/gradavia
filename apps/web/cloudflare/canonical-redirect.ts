export function canonicalRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.hostname !== "www.gradavia.com") return null;
  url.protocol = "https:";
  url.hostname = "gradavia.com";
  url.port = "";
  return Response.redirect(url.toString(), 308);
}
