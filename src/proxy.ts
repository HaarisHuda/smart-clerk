import { NextRequest, NextResponse } from "next/server";

const publicPrefixes = [
  "/api/health",
  "/api/whatsapp/cloud",
  "/_next",
  "/favicon.ico",
];

function isPublicPath(pathname: string): boolean {
  return publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function basicAuthValue(user: string, password: string): string {
  return `Basic ${btoa(`${user}:${password}`)}`;
}

export function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const user = process.env.DASHBOARD_USER || "admin";
  const authorization = request.headers.get("authorization");

  if (authorization === basicAuthValue(user, password)) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Smart Clerk"',
    },
  });
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
