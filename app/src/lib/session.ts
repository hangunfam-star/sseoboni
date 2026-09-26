// Gate 0 임시 사용자 식별 — 실명인증(identity_verified)·휴대폰인증(phone_verified)은
// Gate 1/2 이후 실제 서비스 단계에서 구현. 지금은 닉네임만으로 사용자를 구분하는
// 검증용 스텁이며, 실제 로그인·비밀번호·본인인증이 아님.
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { users, buyerProfiles, sellerProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

const COOKIE_NAME = "sseoboni_uid";

export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function getOrCreateUser(nickname: string) {
  // 닉네임을 그대로 id 시드로 써서 같은 닉네임이면 같은 사용자로 취급 (검증 단계 전용)
  const existingId = `dev_${nickname}`;
  const found = await db.query.users.findFirst({ where: eq(users.id, existingId) });
  if (found) return found;

  const [created] = await db
    .insert(users)
    .values({ id: existingId, role: "BOTH" })
    .returning();
  await db.insert(buyerProfiles).values({ userId: created.id });
  await db.insert(sellerProfiles).values({ userId: created.id });
  return created;
}

export async function setSessionCookie(userId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, userId, { httpOnly: true, sameSite: "lax", path: "/" });
}
