# 기존 이름 전수 조사표

검색어: withdraw (대소문자 무관) · 루트: app/src · 파일 10개 · 줄 63개. 각 ID(파일)마다 계획서에 판단(채널전용/채널무관/변경/유지)을 쓴다.

조사 범위 대장: E:\PROJECTS\04_써보니\docs\review\survey\withdraw2_literal_withdraw.md.manifest.json sha256:143fadbfd11c7c7a5efca1d94cf45007a854421a62c41860961451c0dd651d1e
대장 결과: ok · 읽음 166 · 제외 묶음 1개(2파일) · 오류 0 · git 누락 0 · 열거 168(재집계 168) · git 저장소 아님(git 대조 생략)

| ID | 파일 | 줄 수 | 첫 줄 예시 |
|---|---|---|---|
| F001 | app/api/chats/[id]/route.ts | 2 | 48: if (tx.select({ status: users.status }).from(users).where(eq(users.id… |
| F002 | app/api/me/withdraw/route.ts | 9 | 2: import { clearSessionCookie, getCurrentUserId, sessionUserWithdrawn }… |
| F003 | app/globals.css | 14 | 1208: .withdraw-box { margin-top: 32px; padding-top: 20px; border-top: 1px … |
| F004 | app/me/account/WithdrawForm.tsx | 8 | 9: export function WithdrawForm() { |
| F005 | app/me/account/page.tsx | 3 | 11: import { WithdrawForm } from "./WithdrawForm"; |
| F006 | app/me/page.tsx | 2 | 21: import { withdrawEnabled } from "@/lib/withdraw"; |
| F007 | app/withdrawn/page.tsx | 8 | 8: export default function WithdrawnPage() { |
| F008 | db/schema.ts | 2 | 20: status: text("status").notNull().default("ACTIVE"), // ACTIVE \| WITHD… |
| F009 | lib/session.ts | 2 | 65: export async function sessionUserWithdrawn(): Promise<boolean> { |
| F010 | lib/withdraw.ts | 13 | 1: // 탈퇴 1단계(2026-10-26, docs/review/WITHDRAW_PLAN_v7.md). 시험 서버용 — 운영에서… |

## 제외 묶음 (계획서가 묶음마다 판단: 제외타당/재조사)

| ID | 종류 | 묶음(폴더/확장자) | 파일 수 | 대표 예시 |
|---|---|---|---|---|
| X001 | 확장자 대상 밖 | .png | 2 | app/apple-icon.png, app/icon.png |

## 전체 줄 목록 (파일:줄 내용)
- F001 app/api/chats/[id]/route.ts:48  if (tx.select({ status: users.status }).from(users).where(eq(users.id, other)).get()?.status === "WITHDRAWN")…
- F001 app/api/chats/[id]/route.ts:63  if (saved === "WITHDRAWN") return NextResponse.json({ error: "탈퇴한 사용자와는 대화할 수 없어요." }, { status: 409 });
- F002 app/api/me/withdraw/route.ts:2  import { clearSessionCookie, getCurrentUserId, sessionUserWithdrawn } from "@/lib/session";
- F002 app/api/me/withdraw/route.ts:3  import { blockersOf, withdrawEnabled, withdrawUser, withdrawConfirmOk } from "@/lib/withdraw";
- F002 app/api/me/withdraw/route.ts:7  // GET /api/me/withdraw — 탈퇴를 막는 거래 목록
- F002 app/api/me/withdraw/route.ts:9  if (!withdrawEnabled()) return OFF();
- F002 app/api/me/withdraw/route.ts:15  // POST /api/me/withdraw { confirm: 자유 입력(공백 아닌 1~500자, 저장 안 함) } — 본인만, 본문의 사용자 id는 받지 않는다
- F002 app/api/me/withdraw/route.ts:17  if (!withdrawEnabled()) return OFF();
- F002 app/api/me/withdraw/route.ts:21  if (await sessionUserWithdrawn()) { await clearSessionCookie(); return NextResponse.json({ ok: true, already:…
- F002 app/api/me/withdraw/route.ts:25  if (!withdrawConfirmOk(body?.confirm)) return NextResponse.json({ error: "탈퇴하려면 칸에 아무 내용이나 입력해 주세요(500자까지)." …
- F002 app/api/me/withdraw/route.ts:26  const r = withdrawUser(userId);
- F003 app/globals.css:1208  .withdraw-box { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--color-line, #e6e6e6); displa…
- F003 app/globals.css:1209  .withdraw-box form { display: grid; gap: 12px; }
- F003 app/globals.css:1210  .withdraw-list { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
- F003 app/globals.css:1211  .withdraw-blockers { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 14px; }
- F003 app/globals.css:1212  .withdraw-submit { background: #b2402f; }
- F003 app/globals.css:1213  .withdraw-submit:disabled:not([aria-busy="true"]) { cursor: not-allowed; } /* 문구 입력 전: 로딩처럼 보이지 않게 */
- F003 app/globals.css:1215  .withdrawn-page { min-height: 70vh; align-content: center; }
- F003 app/globals.css:1216  .withdrawn-card { display: grid; justify-items: center; gap: 14px; padding: 32px 22px 24px; border-radius: va…
- F003 app/globals.css:1217  .withdrawn-badge { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; backgro…
- F003 app/globals.css:1218  .withdrawn-badge svg { width: 26px; height: 26px; }
- F003 app/globals.css:1219  .withdrawn-title { margin: 4px 0 0; font-size: 24px; font-weight: 800; color: var(--color-ink); }
- F003 app/globals.css:1220  .withdrawn-lead { margin: 0; font-size: 15px; color: var(--color-muted); }
- F003 app/globals.css:1221  .withdrawn-list { margin: 6px 0 4px; padding: 14px 16px 14px 32px; width: 100%; box-sizing: border-box; borde…
- F003 app/globals.css:1222  .withdrawn-home { margin-top: 6px; }
- F004 app/me/account/WithdrawForm.tsx:9  export function WithdrawForm() {
- F004 app/me/account/WithdrawForm.tsx:23  res = await fetch("/api/me/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body…
- F004 app/me/account/WithdrawForm.tsx:33  if (res.ok) { window.location.replace("/withdrawn"); return; }
- F004 app/me/account/WithdrawForm.tsx:39  <section className="withdraw-box" aria-labelledby="withdraw-title">
- F004 app/me/account/WithdrawForm.tsx:40  <h2 className="section-title" id="withdraw-title">탈퇴하기</h2>
- F004 app/me/account/WithdrawForm.tsx:43  <ul className="field-hint withdraw-list">
- F004 app/me/account/WithdrawForm.tsx:56  <ul className="withdraw-blockers">
- F004 app/me/account/WithdrawForm.tsx:62  <button className="dark-button withdraw-submit" type="submit" disabled={pending || text.trim() === ""} aria-b…
- F005 app/me/account/page.tsx:11  import { WithdrawForm } from "./WithdrawForm";
- F005 app/me/account/page.tsx:12  import { withdrawEnabled } from "@/lib/withdraw";
- F005 app/me/account/page.tsx:31  {withdrawEnabled() && <WithdrawForm />}
- F006 app/me/page.tsx:21  import { withdrawEnabled } from "@/lib/withdraw";
- F006 app/me/page.tsx:126  {withdrawEnabled() && <Link href="/me/account#withdraw-title"><strong><Icon name="user" />탈퇴하기</strong><small…
- F007 app/withdrawn/page.tsx:8  export default function WithdrawnPage() {
- F007 app/withdrawn/page.tsx:10  <div className="page withdrawn-page">
- F007 app/withdrawn/page.tsx:11  <section className="withdrawn-card" aria-live="polite">
- F007 app/withdrawn/page.tsx:12  <span className="withdrawn-badge" aria-hidden="true"><Icon name="check" /></span>
- F007 app/withdrawn/page.tsx:13  <h1 className="withdrawn-title">탈퇴가 끝났어요</h1>
- F007 app/withdrawn/page.tsx:14  <p className="withdrawn-lead">그동안 써보니를 써 주셔서 고마워요.</p>
- F007 app/withdrawn/page.tsx:15  <ul className="withdrawn-list">
- F007 app/withdrawn/page.tsx:20  <Link className="dark-button withdrawn-home" href="/">처음 화면으로</Link>
- F008 db/schema.ts:20  status: text("status").notNull().default("ACTIVE"), // ACTIVE | WITHDRAWN(탈퇴) | SYSTEM
- F008 db/schema.ts:21  withdrawnAt: text("withdrawn_at"), // 탈퇴한 시각(탈퇴 1단계, 2026-10-26)
- F009 lib/session.ts:65  export async function sessionUserWithdrawn(): Promise<boolean> {
- F009 lib/session.ts:69  return user?.status === "WITHDRAWN";
- F010 lib/withdraw.ts:1  // 탈퇴 1단계(2026-10-26, docs/review/WITHDRAW_PLAN_v7.md). 시험 서버용 — 운영에서는 WITHDRAW_ENABLED가 정확히 "1"이 아니면 꺼져 있다.
- F010 lib/withdraw.ts:15  export function withdrawConfirmOk(v: unknown): boolean {
- F010 lib/withdraw.ts:18  export const WITHDRAWN_NAME = "탈퇴한 사용자";
- F010 lib/withdraw.ts:25  export type WithdrawResult = { ok: true } | { already: true } | { blockers: Blocker[] };
- F010 lib/withdraw.ts:28  export function withdrawEnabled(): boolean {
- F010 lib/withdraw.ts:29  return process.env.WITHDRAW_ENABLED === "1";
- F010 lib/withdraw.ts:62  if (withdrawEnabled() && process.env.NODE_ENV !== "production" && process.env.WITHDRAW_FAULT === at) throw ne…
- F010 lib/withdraw.ts:66  export function withdrawUser(userId: string): WithdrawResult {
- F010 lib/withdraw.ts:67  return db.transaction((tx): WithdrawResult => {
- F010 lib/withdraw.ts:72  if (tx.update(users).set({ status: "WITHDRAWN" }).where(and(eq(users.id, userId), eq(users.status, "ACTIVE"))…
- F010 lib/withdraw.ts:94  if (chatNoteIds.length > 0) tx.update(notifications).set({ body: `${WITHDRAWN_NAME}님이 메시지를 보냈어요.` }).where(in…
- F010 lib/withdraw.ts:107  notifyTx(tx, p.buyerId, { category: "TRADE", title: `써보기 제안 취소 · ${titleById.get(p.listingId)}`, body: "판매자가 …
- F010 lib/withdraw.ts:113  tx.update(users).set({ nickname: WITHDRAWN_NAME, kakaoImageUrl: null, showPhoto: false, withdrawnAt: sql`curr…
생성표 해시: 0171b00372673c6e9a46d96e975393ef3f2f7f869cab12f1cb06a89a96446f19
