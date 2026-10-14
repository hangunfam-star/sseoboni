// 카카오 로그인(REST API 방식). 카카오 회원번호만 받아 써보니 계정과 연결한다(닉네임·이메일 등 개인정보 동의항목 없음).
// 키는 서버 .env의 KAKAO_REST_KEY·KAKAO_CLIENT_SECRET. 둘 중 하나라도 없으면 카카오 로그인 버튼을 보이지 않는다.
// KAKAO_AUTH_BASE·KAKAO_API_BASE는 시험용 가짜 카카오 서버 주소로 바꿀 때만 쓴다(기본값은 실제 카카오).
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import { socialAccounts, users } from "@/db/schema";
import { readSignedValue } from "@/lib/session";

export const KAKAO = "KAKAO";
export const STATE_COOKIE = "sseoboni_kakao_state";
export const PENDING_COOKIE = "sseoboni_kakao_new";
export const STATE_MINUTES = 10;

export type KakaoMode = "login" | "link";
export type KakaoState = { s: string; m: KakaoMode; n: string; e: number };
export type KakaoPending = { k: string; e: number; n?: string; i?: string }; // n: 카카오 닉네임, i: 카카오 프로필 사진 주소(각각 동의한 경우만)

export class KakaoError extends Error {
  constructor(public code: string) { super(code); }
}

function cfg() {
  return {
    restKey: process.env.KAKAO_REST_KEY?.trim() ?? "",
    clientSecret: process.env.KAKAO_CLIENT_SECRET?.trim() ?? "",
    authBase: (process.env.KAKAO_AUTH_BASE || "https://kauth.kakao.com").replace(/\/$/, ""),
    apiBase: (process.env.KAKAO_API_BASE || "https://kapi.kakao.com").replace(/\/$/, ""),
  };
}

// return: 키가 모두 있으면 true(버튼 표시)
export function kakaoConfigured(): boolean {
  const c = cfg();
  return Boolean(c.restKey && c.clientSecret);
}

// param: req 요청. return: 사이트 주소(https://sseoboni.mwwork.co.kr). 프록시 뒤에서도 https를 유지한다
export function siteOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

// param: origin 사이트 주소. return: 카카오에 등록한 리다이렉트 URI(KAKAO_REDIRECT_URI가 있으면 그것)
export function redirectUri(origin: string): string {
  return process.env.KAKAO_REDIRECT_URI?.trim() || `${origin}/api/auth/kakao/callback`;
}

// param: raw 돌아갈 경로. return: 같은 사이트 안의 경로만(외부 주소로 보내지 않음)
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : fallback;
}

// param: state 위조 방지값, origin 사이트 주소. return: 카카오 동의 화면 주소
export function authorizeUrl(state: string, origin: string): string {
  const c = cfg();
  const q = new URLSearchParams({ client_id: c.restKey, redirect_uri: redirectUri(origin), response_type: "code", state });
  // 이미 연결한 사용자에게도 아직 동의 안 한 닉네임·프로필 사진을 한 번 묻는다. KAKAO_SCOPE= (빈 값)이면 묻지 않음
  const scope = (process.env.KAKAO_SCOPE ?? "profile_nickname,profile_image").trim();
  if (scope) q.set("scope", scope);
  return `${c.authBase}/oauth/authorize?${q}`;
}

// param: raw 카카오가 준 사진 주소. return: 카카오 사진 서버의 https 주소만, 아니면 null
export function cleanKakaoImage(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 500) return null;
  try {
    const u = new URL(raw.replace(/^http:\/\//, "https://"));
    return u.protocol === "https:" && (u.hostname === "kakaocdn.net" || u.hostname.endsWith(".kakaocdn.net")) ? u.toString() : null;
  } catch { return null; }
}

// param: userId 사용자, image 카카오 사진 주소(없으면 null). return: 없음. 카카오 로그인할 때마다 최신 사진으로 바꾼다(보일지는 showPhoto가 정함)
export function saveKakaoImage(userId: string, image: string | null): void {
  db.update(users).set({ kakaoImageUrl: image }).where(eq(users.id, userId)).run();
}

// param: u 사용자 행. return: 화면에 보일 프로필 사진 주소, 숨겼거나 없으면 null
export function photoOf(u: { kakaoImageUrl: string | null; showPhoto: boolean } | null | undefined): string | null {
  return u && u.showPhoto && u.kakaoImageUrl ? u.kakaoImageUrl : null;
}

type KakaoMe = { id: string; nickname: string | null; image: string | null };
const seenCodes = new Map<string, { at: number; p: Promise<KakaoMe> }>();

// param: code 인가 코드, origin 사이트 주소. return: kakaoUserId 결과. 같은 코드가 1분 안에 다시 오면(휴대폰 브라우저가 콜백을 두 번 부름) 카카오에 다시 묻지 않고 첫 결과를 함께 쓴다
export function kakaoUserIdOnce(code: string, origin: string): Promise<KakaoMe> {
  const now = Date.now();
  for (const [k, v] of seenCodes) if (now - v.at > 60_000) seenCodes.delete(k);
  const hit = seenCodes.get(code);
  if (hit) return hit.p;
  const p = kakaoUserId(code, origin);
  seenCodes.set(code, { at: now, p });
  return p;
}

// param: code 카카오가 돌려준 인가 코드, origin 사이트 주소. return: 카카오 회원번호(문자열)·닉네임·프로필 사진(동의한 경우만). 예외: KakaoError("token"|"profile")
export async function kakaoUserId(code: string, origin: string): Promise<KakaoMe> {
  const c = cfg();
  const tokenRes = await fetch(`${c.authBase}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: c.restKey, client_secret: c.clientSecret, redirect_uri: redirectUri(origin), code }),
    cache: "no-store",
  }).catch(() => null);
  const token = (await tokenRes?.json().catch(() => null)) as { access_token?: string; error?: string; error_code?: string } | null;
  if (!tokenRes?.ok || !token?.access_token) {
    console.error(`[kakao] token 실패 status=${tokenRes?.status ?? "network"} error=${token?.error ?? "-"} code=${token?.error_code ?? "-"}`); // 비밀값·인가 코드는 남기지 않음
    throw new KakaoError("token");
  }
  const meRes = await fetch(`${c.apiBase}/v2/user/me`, { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" }).catch(() => null);
  const me = meRes?.ok ? ((await meRes.json().catch(() => null)) as { id?: number | string; kakao_account?: { profile?: { nickname?: string; thumbnail_image_url?: string; profile_image_url?: string; is_default_image?: boolean } }; properties?: { nickname?: string } } | null) : null;
  if (me?.id === undefined || me.id === null || !/^\d+$/.test(String(me.id))) {
    console.error(`[kakao] profile 실패 status=${meRes?.status ?? "network"}`);
    throw new KakaoError("profile");
  }
  const nickname = me.kakao_account?.profile?.nickname ?? me.properties?.nickname ?? null;
  const p = me.kakao_account?.profile;
  const image = p && p.is_default_image !== true ? cleanKakaoImage(p.thumbnail_image_url ?? p.profile_image_url) : null;
  return { id: String(me.id), nickname: typeof nickname === "string" && nickname.trim() ? nickname.trim() : null, image };
}

// param: kakaoId 카카오 회원번호. return: 연결된 사용자 id(정상 계정만), 없으면 null
export function userOfKakao(kakaoId: string): string | null {
  const row = db.select({ userId: socialAccounts.userId, status: users.status }).from(socialAccounts)
    .innerJoin(users, eq(users.id, socialAccounts.userId))
    .where(and(eq(socialAccounts.provider, KAKAO), eq(socialAccounts.providerUserId, kakaoId))).get();
  return row && row.status === "ACTIVE" ? row.userId : null;
}

// param: userId 사용자. return: 카카오가 연결돼 있으면 true
export function hasKakao(userId: string): boolean {
  return Boolean(db.select({ u: socialAccounts.userId }).from(socialAccounts)
    .where(and(eq(socialAccounts.provider, KAKAO), eq(socialAccounts.userId, userId))).get());
}

// param: userId 사용자, kakaoId 카카오 회원번호. 예외: KakaoError("taken" 다른 계정에 연결됨 | "has-other" 이 계정에 다른 카카오가 연결됨)
export function linkKakao(userId: string, kakaoId: string): void {
  db.transaction((tx) => {
    const owner = tx.select({ userId: socialAccounts.userId }).from(socialAccounts)
      .where(and(eq(socialAccounts.provider, KAKAO), eq(socialAccounts.providerUserId, kakaoId))).get();
    if (owner && owner.userId !== userId) throw new KakaoError("taken");
    if (owner) return; // 이미 같은 계정에 연결됨
    if (tx.select({ u: socialAccounts.userId }).from(socialAccounts).where(and(eq(socialAccounts.provider, KAKAO), eq(socialAccounts.userId, userId))).get()) throw new KakaoError("has-other");
    tx.insert(socialAccounts).values({ provider: KAKAO, providerUserId: kakaoId, userId }).run();
  });
}

// param: userId 사용자. return: 연결을 지웠으면 true
export function unlinkKakao(userId: string): boolean {
  return db.delete(socialAccounts).where(and(eq(socialAccounts.provider, KAKAO), eq(socialAccounts.userId, userId))).run().changes > 0;
}

// param: raw 대기 쿠키 값. return: 서명이 맞고 아직 유효한 카카오 가입 대기 정보, 아니면 null
export function readPending(raw: string | undefined): KakaoPending | null {
  const p = readSignedValue<KakaoPending>(raw);
  return p && p.e > Date.now() ? p : null;
}

// 화면에 보여 줄 안내 문구(쿼리 ?kakao=코드)
export const KAKAO_MESSAGES: Record<string, string> = {
  linked: "카카오가 연결됐어요. 이제 다른 기기에서도 카카오로 들어올 수 있어요.",
  unlinked: "카카오 연결을 해제했어요.",
  cancel: "카카오 로그인을 취소했어요.",
  state: "로그인 시간이 지났거나 잘못된 요청이에요. 다시 시도해 주세요.",
  token: "카카오에서 확인을 받지 못했어요. 잠시 후 다시 시도해 주세요.",
  profile: "카카오 회원 정보를 받지 못했어요. 잠시 후 다시 시도해 주세요.",
  taken: "이 카카오 계정은 이미 다른 써보니 계정에 연결돼 있어요.",
  "has-other": "이 계정에는 이미 다른 카카오 계정이 연결돼 있어요.",
  "need-login": "먼저 써보니에 들어온 뒤 카카오를 연결해 주세요.",
  off: "카카오 로그인이 아직 준비 중이에요.",
  expired: "카카오 확인 시간이 지났어요. 다시 카카오로 시작해 주세요.",
};
