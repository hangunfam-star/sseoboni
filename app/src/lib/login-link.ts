// 계정 복구용 로그인. ① 운영자가 만드는 1회용 링크(24시간) ② 예전 주소(ngrok) 로그인을 새 주소로 넘겨받기(2분짜리 서명 표).
// 링크 원문은 DB에 두지 않고 해시만 저장한다. 링크를 여는 것(GET)만으로는 쓰이지 않고, 화면의 버튼(POST)을 눌러야 쓰인다
// — 카카오톡 미리보기 로봇이 링크를 먼저 열어도 링크가 소모되지 않게.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { loginLinks, users } from "@/db/schema";
import { readSignedValue } from "@/lib/session";

export const LINK_HOURS = 24;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

// param: userId 복구할 계정. return: 링크에 넣을 원문(한 번만 보여 준다). 같은 계정의 쓰지 않은 예전 링크는 지운다
export function createLoginLink(userId: string): { token: string; expiresAt: string } {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_HOURS * 3600_000).toISOString();
  db.transaction((tx) => {
    tx.delete(loginLinks).where(and(eq(loginLinks.userId, userId), isNull(loginLinks.usedAt))).run();
    tx.insert(loginLinks).values({ tokenHash: hash(token), userId, expiresAt }).run();
  });
  return { token, expiresAt };
}

// param: token 링크 원문. return: 쓸 수 있으면 계정 닉네임, 아니면 쓸 수 없는 이유(소모하지 않음)
export function peekLoginLink(token: string): { ok: true; nickname: string | null } | { ok: false; reason: "invalid" | "used" | "expired" } {
  if (!token) return { ok: false, reason: "invalid" };
  const row = db.select({ l: loginLinks, nickname: users.nickname, status: users.status }).from(loginLinks)
    .innerJoin(users, eq(users.id, loginLinks.userId)).where(eq(loginLinks.tokenHash, hash(token))).get();
  if (!row || row.status !== "ACTIVE") return { ok: false, reason: "invalid" };
  if (row.l.usedAt) return { ok: false, reason: "used" };
  if (row.l.expiresAt <= new Date().toISOString()) return { ok: false, reason: "expired" };
  return { ok: true, nickname: row.nickname };
}

// param: token 링크 원문. return: 쓰는 데 성공하면 계정 id(같은 링크를 동시에 눌러도 한 번만 성공), 아니면 null
export function consumeLoginLink(token: string): string | null {
  if (!token) return null;
  const now = new Date().toISOString();
  const row = db.update(loginLinks).set({ usedAt: now })
    .where(and(eq(loginLinks.tokenHash, hash(token)), isNull(loginLinks.usedAt), gt(loginLinks.expiresAt, now)))
    .returning({ userId: loginLinks.userId }).get();
  if (!row) return null;
  const user = db.select({ status: users.status }).from(users).where(eq(users.id, row.userId)).get();
  return user?.status === "ACTIVE" ? row.userId : null;
}

// 예전 주소 넘겨받기 표: { k: "carry", u: 계정, e: 만료(ms), n: 1회용 번호 }. 같은 번호는 서버가 켜져 있는 동안 한 번만 받는다.
type Carry = { k: string; u: string; e: number; n: string };
const g = globalThis as typeof globalThis & { __sseoboniCarryNonces?: Map<string, number> };
const usedCarry = (g.__sseoboniCarryNonces ??= new Map<string, number>());

// param: raw 표 문자열. return: 유효하면 계정 id, 아니면 null
export function readCarry(raw: string | null): string | null {
  const c = readSignedValue<Carry>(raw ?? undefined);
  const now = Date.now();
  if (!c || c.k !== "carry" || typeof c.u !== "string" || typeof c.n !== "string" || !(c.e > now) || c.e > now + 5 * 60_000) return null;
  for (const [n, e] of usedCarry) if (e < now) usedCarry.delete(n);
  if (usedCarry.has(c.n)) return null;
  usedCarry.set(c.n, c.e);
  const user = db.select({ status: users.status }).from(users).where(eq(users.id, c.u)).get();
  return user?.status === "ACTIVE" ? c.u : null;
}
