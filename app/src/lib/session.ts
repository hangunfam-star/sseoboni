// Gate 0 테스터 세션 — 실명인증(identity_verified)·휴대폰인증(phone_verified)은
// Gate 1/2 이후 실제 서비스 단계에서 구현. 지금은 개인 초대 코드로 테스터를 식별하고,
// 서버 비밀키(SESSION_SECRET)로 서명한 쿠키로 세션을 유지한다. 닉네임은 표시용일 뿐이다.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { users, buyerProfiles, sellerProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { findActiveInviteByUserId, type Invite } from "@/lib/invites";

const COOKIE_NAME = "sseoboni_sid";
const SESSION_DAYS = 30;

// return: 서명 키. 없거나 32자 미만이면 null(세션 전체 비활성 = 안전한 쪽으로 실패)
function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

export function sessionConfigured(): boolean {
  return secret() !== null;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

// return: 검증된 userId 또는 null (서명·만료·초대 폐기·사용자 상태 모두 확인)
export async function getCurrentUserId(): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const [userId, exp, sig] = raw.split(".");
  if (!userId || !exp || !sig) return null;
  const expected = Buffer.from(sign(`${userId}.${exp}`, key));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return null;

  if (!findActiveInviteByUserId(userId)) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || user.status !== "ACTIVE") return null;
  return userId;
}

// param: invite 유효한 초대. return: 초대에 고정된 사용자(없으면 생성)
export async function getOrCreateInviteUser(invite: Invite) {
  const found = await db.query.users.findFirst({ where: eq(users.id, invite.userId) });
  if (found) return found;

  return db.transaction((tx) => {
    const created = tx.insert(users).values({ id: invite.userId, role: "BOTH" }).returning().get();
    tx.insert(buyerProfiles).values({ userId: created.id }).run();
    tx.insert(sellerProfiles).values({ userId: created.id }).run();
    return created;
  });
}

// param: userId 초대로 확인된 사용자. 예외: SESSION_SECRET 미설정 시 throw
export async function setSessionCookie(userId: string) {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET is not configured");
  const exp = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  (await cookies()).set(COOKIE_NAME, `${userId}.${exp}.${sign(`${userId}.${exp}`, key)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE_NAME);
}
