import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { marketValidationEvents, users } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { createLoginLink } from "@/lib/login-link";
import { siteOrigin } from "@/lib/kakao";

// POST /api/admin/login-link { userId } — 운영자만. 계정 복구용 1회용 로그인 링크(24시간)를 만든다. 만든 기록은 LOGIN_LINK_ISSUED로 남긴다.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "운영자만 만들 수 있어요." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const user = userId ? db.select({ status: users.status }).from(users).where(eq(users.id, userId)).get() : undefined;
  if (!user || user.status !== "ACTIVE") return NextResponse.json({ error: "복구할 수 있는 계정이 아니에요." }, { status: 404 });
  const { token, expiresAt } = createLoginLink(userId);
  await db.insert(marketValidationEvents).values({ eventType: "LOGIN_LINK_ISSUED", metadata: JSON.stringify({ userId, expiresAt }) });
  return NextResponse.json({ url: `${siteOrigin(req)}/login/link?t=${token}`, expiresAt });
}
