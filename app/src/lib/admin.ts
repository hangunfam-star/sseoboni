// 운영자 결과 화면 입장: .env의 ADMIN_KEY를 아는 사람만, 서명한 쿠키(12시간)로 유지한다.
// 쿠키에는 서버가 발급한 일회용 번호(nonce)를 넣고 서버 메모리에 기록한다.
// → 로그아웃하면 그 쿠키는 복사본까지 즉시 무효, ADMIN_KEY를 바꾸거나 서버를 다시 켜면 모든 운영자 쿠키가 무효.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "sseoboni_admin";
const TTL_SEC = 12 * 60 * 60;
// nonce → 만료 시각(초). Next는 화면(RSC)과 API(route)에 이 모듈을 따로 올리므로, 한 프로세스에서 하나만 쓰도록 globalThis에 둔다.
const g = globalThis as typeof globalThis & { __sseoboniAdminNonces?: Map<string, number> };
const issued = (g.__sseoboniAdminNonces ??= new Map<string, number>());

// return: 서명 키. ADMIN_KEY가 바뀌면 키도 바뀌어 이전 쿠키가 모두 무효가 된다.
function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  const k = process.env.ADMIN_KEY;
  if (!s || s.length < 16 || !k) return null;
  return `${s}:admin:${createHash("sha256").update(k).digest("hex")}`;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// return: ADMIN_KEY(16자 이상)·SESSION_SECRET이 모두 설정돼 있으면 true
export function adminConfigured(): boolean {
  return (process.env.ADMIN_KEY?.length ?? 0) >= 16 && Boolean(secret());
}

// param: key 사용자가 입력한 키. return: ADMIN_KEY와 같으면 true
export function checkAdminKey(key: string): boolean {
  const real = process.env.ADMIN_KEY;
  return adminConfigured() && same(key, real!);
}

// param: raw 쿠키 값. return: 유효하면 nonce, 아니면 null
function verify(raw: string): string | null {
  const key = secret();
  if (!key || !adminConfigured()) return null;
  const [exp, nonce, sig] = raw.split(".");
  if (!exp || !nonce || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return null;
  if (!same(sig, sign(`admin.${exp}.${nonce}`, key))) return null;
  return issued.get(nonce) === Number(exp) ? nonce : null;
}

// return: 지금 요청이 유효한 운영자 쿠키를 가졌으면 true
export async function isAdmin(): Promise<boolean> {
  return verify((await cookies()).get(COOKIE)?.value ?? "") !== null;
}

export async function setAdminCookie(): Promise<void> {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET/ADMIN_KEY is not configured");
  const now = Math.floor(Date.now() / 1000);
  for (const [n, e] of issued) if (e < now) issued.delete(n);
  const exp = now + TTL_SEC;
  const nonce = randomBytes(16).toString("hex");
  issued.set(nonce, exp);
  (await cookies()).set(COOKIE, `${exp}.${nonce}.${sign(`admin.${exp}.${nonce}`, key)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SEC,
  });
}

// 로그아웃: 브라우저 쿠키를 지우고, 서버 기록도 지워 복사된 쿠키까지 막는다.
export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  const nonce = verify(jar.get(COOKIE)?.value ?? "");
  if (nonce) issued.delete(nonce);
  jar.delete(COOKIE);
}
