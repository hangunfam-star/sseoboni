// 운영자 결과 화면 입장: .env의 ADMIN_KEY를 아는 사람만, 서명한 쿠키(12시간)로 유지한다.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "sseoboni_admin";
const TTL_SEC = 12 * 60 * 60;

function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 16 ? `${s}:admin` : null;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// return: ADMIN_KEY·SESSION_SECRET이 모두 설정돼 있으면 true
export function adminConfigured(): boolean {
  return (process.env.ADMIN_KEY?.length ?? 0) >= 16 && Boolean(secret());
}

// param: key 사용자가 입력한 키. return: ADMIN_KEY와 같으면 true
export function checkAdminKey(key: string): boolean {
  const real = process.env.ADMIN_KEY;
  return adminConfigured() && same(key, real!);
}

// return: 지금 요청이 유효한 운영자 쿠키를 가졌으면 true
export async function isAdmin(): Promise<boolean> {
  const key = secret();
  if (!key || !adminConfigured()) return false;
  const raw = (await cookies()).get(COOKIE)?.value ?? "";
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return same(sig, sign(`admin.${exp}`, key));
}

export async function setAdminCookie(): Promise<void> {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET is not configured");
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  (await cookies()).set(COOKIE, `${exp}.${sign(`admin.${exp}`, key)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SEC,
  });
}

export async function clearAdminCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
