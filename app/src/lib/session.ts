// Gate 0 테스터 세션 — 링크를 받은 누구나 닉네임만 정하면 바로 참여한다.
// 서버가 추측할 수 없는 무작위 사용자 id를 만들고, SESSION_SECRET으로 서명한 쿠키로 그 id를 유지한다.
// 닉네임은 화면 표시용일 뿐 로그인 식별에 쓰지 않으므로, 같은 닉네임을 입력해도 남의 계정에 들어갈 수 없다.
// 실명인증(identity_verified)·휴대폰인증(phone_verified)은 Gate 1/2 이후 단계에서 구현한다.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { users, buyerProfiles, sellerProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

const COOKIE_NAME = "sseoboni_sid";
const SESSION_DAYS = 30;
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;

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

// param: raw 사용자가 입력한 닉네임. return: 정리된 닉네임, 규칙 위반이면 null
export function cleanNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.normalize("NFC").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim();
  const len = Array.from(v).length;
  return len >= NICKNAME_MIN && len <= NICKNAME_MAX ? v : null;
}

// return: 검증된 userId 또는 null (서명·만료·사용자 존재·ACTIVE 상태 확인)
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

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || user.status !== "ACTIVE") return null;
  return userId;
}

// param: nickname 정리된 닉네임. return: 새로 만든 사용자(무작위 id)
export function createUser(nickname: string) {
  const id = `u_${randomBytes(12).toString("hex")}`;
  return db.transaction((tx) => {
    const created = tx.insert(users).values({ id, role: "BOTH", nickname }).returning().get();
    tx.insert(buyerProfiles).values({ userId: created.id }).run();
    tx.insert(sellerProfiles).values({ userId: created.id }).run();
    return created;
  });
}

// param: userId 세션을 만들 사용자. 예외: SESSION_SECRET 미설정 시 throw
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

// param: payload 쿠키에 담을 값(객체). return: "본문.서명" 문자열. 짧게 쓰는 확인용 쿠키(카카오 로그인 상태 등)에 쓴다. 예외: SESSION_SECRET 미설정 시 throw
export function signValue(payload: object): string {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET is not configured");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, key)}`;
}

// param: raw signValue로 만든 문자열. return: 서명이 맞으면 담긴 값, 아니면 null
export function readSignedValue<T>(raw: string | undefined): T | null {
  const key = secret();
  if (!key || !raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body, key));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try { return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T; } catch { return null; }
}

// 같은 접속지에서 계정을 대량으로 만드는 것을 막는 간단한 제한(서버 메모리 기준, 재시작 시 초기화)
const CREATE_LIMIT_PER_HOUR = 20;
const createLog = new Map<string, number[]>();

// param: ip 접속지, now 현재 시각(ms). return: 이번 생성이 허용되면 true
export function allowCreate(ip: string, now: number): boolean {
  const recent = (createLog.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= CREATE_LIMIT_PER_HOUR) {
    createLog.set(ip, recent);
    return false;
  }
  recent.push(now);
  createLog.set(ip, recent);
  return true;
}
