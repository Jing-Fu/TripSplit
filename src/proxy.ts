import { NextRequest, NextResponse } from "next/server";

const LINE_WEBHOOK_PATH = "/api/line/webhook";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname !== LINE_WEBHOOK_PATH && pathname.startsWith(`${LINE_WEBHOOK_PATH}/`)) {
    const rewrittenUrl = request.nextUrl.clone();
    rewrittenUrl.pathname = LINE_WEBHOOK_PATH;
    return NextResponse.rewrite(rewrittenUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/line/webhook/:path*"],
};
