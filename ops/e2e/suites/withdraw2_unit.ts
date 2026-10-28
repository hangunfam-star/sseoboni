// 탈퇴 2단계 단위 시험(docs/review/WITHDRAW_PLAN_v12.md 9절·00000절 중 서버 없이 되는 것).
// 사용(app 폴더): $env:DATABASE_URL='file:<마이그레이션한 사본 DB>'; npx tsx ../ops/e2e/suites/withdraw2_unit.ts
//   WD2_ROOT: 임시 runtime-data를 만들 폴더(기본 E:/PROJECTS/_work/04_써보니/withdraw2_test/run). 시험마다 하위 폴더로 cwd를 옮긴다.
import { spawnSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type DatabaseT from "better-sqlite3";
import type SharpT from "sharp";
import type { NextRequest as NextRequestT } from "next/server";
import { db, dbPath } from "@/db/client";
import {
  acquireRetainLock, backupRetained, beforeFileOp, closeRetained, createBackupSet, dailyRetainedBackup, ensureKey, keyIdFor, listSets, purgeRetained, putFile, putValues,
  releaseRetainLock, restoreSet, retainClock, retainedDb, retainHooks, retainOpen, retainOpenFile, retainReady, retainTx, rtDir, setKeyIds, withRetainLock, FenceLost,
} from "@/lib/retain";
import { SafePhoto } from "@/components/SafePhoto";
import { PhotoGallery } from "@/components/PhotoGallery";
import { cleanupOrphans, retainPending, retainUser, withdrawHooks, withdrawUser, WITHDRAWN_LISTING, WITHDRAWN_MEMO, WITHDRAWN_MSG } from "@/lib/withdraw";
import { cleanupUploadOrphans, commitPhoto, discardStaged, readPhoto, savePhoto } from "@/lib/photos";
import { GET as photoGET } from "@/app/api/photos/[file]/route";
import { POST as withdrawPOST } from "@/app/api/me/withdraw/route";

const ROOT = process.env.WD2_ROOT ?? "E:/PROJECTS/_work/04_써보니/withdraw2_test/run";
const APP = process.cwd();
// 이 파일은 app 밖(ops)에 있어 패키지는 app/node_modules에서 불러온다
const appRequire = createRequire(path.join(APP, "package.json"));
const Database = appRequire("better-sqlite3") as typeof DatabaseT;
const sharp = appRequire("sharp") as typeof SharpT;
const { NextRequest } = appRequire("next/server") as { NextRequest: typeof NextRequestT };
process.env.RETAIN_SECRET = "s".repeat(48);
const sq = db.$client;
let fail = 0, pass = 0;
const check = (name: string, ok: boolean, detail = "") => { if (ok) pass++; else fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : detail); };
const hex = (n: number) => randomBytes(n).toString("hex");
const NOW = Date.now();
const H = 3600_000, D = 24 * H;

// param: name 하위 폴더. 새 runtime-data 폴더로 cwd를 옮기고 보관 DB 연결을 닫는다
function useRt(name: string) {
  closeRetained();
  const d = path.join(ROOT, name);
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(path.join(d, "runtime-data"), { recursive: true });
  process.chdir(d);
}
const MODEL = (sq.prepare("SELECT id FROM product_models LIMIT 1").get() as { id: string }).id;

function user(nick = "닉"): string {
  const id = `t_${hex(6)}`;
  sq.prepare("INSERT INTO users(id, role, nickname, kakao_image_url) VALUES(?, 'BOTH', ?, 'http://img/x.png')").run(id, nick);
  return id;
}
// param: kind 사진 종류, content 파일 내용. return: 원래 폴더에 만든 파일 이름
function photoFile(kind: "listing" | "order", content: string): string {
  const name = `${hex(12)}.webp`;
  const dir = rtDir(kind === "order" ? "order-uploads" : "uploads");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), content);
  return name;
}
const id = () => crypto.randomUUID();
let seq = 9_000_000 + Math.floor(Math.random() * 100_000);

type Trade = { listing: string; listing2: string; order: string; thread: string; thread2: string; lphoto: string; bphoto: string; sphoto: string; sysMsg: string; dispute: string; ev: string; mk: string; rev: string; trev: string; fb: string; rep: string; ll: string; note: string };
// param: s 판매자, b 구매자, mk 고유 표식, opt. return: 만든 거래 자료 id. 탈퇴자가 쓴 칸마다 표식을 넣는다
function makeTrade(s: string, b: string, mk: string, opt: { dispute?: boolean; completed?: string } = {}): Trade {
  const t = { mk } as Trade;
  t.listing = id(); t.listing2 = id();
  sq.prepare("INSERT INTO listings(id, seller_id, model_id, title, price, condition_grade, description, status, check_items) VALUES(?, ?, ?, ?, 1000, 'A', ?, 'SOLD', ?)")
    .run(t.listing, s, MODEL, `상품${mk}`, `설명${mk}`, JSON.stringify([{ key: "zzz", label: "메모", value: `점검${mk}` }]));
  sq.prepare("INSERT INTO listings(id, seller_id, model_id, title, price, condition_grade, description, status) VALUES(?, ?, ?, ?, 1000, 'A', ?, 'ACTIVE')").run(t.listing2, s, MODEL, `둘째${mk}`, `둘째설명${mk}`);
  t.lphoto = photoFile("listing", `LPHOTO${mk}`);
  sq.prepare("INSERT INTO listing_photos(id, listing_id, file_name, width, height) VALUES(?, ?, ?, 10, 10)").run(id(), t.listing, t.lphoto);
  sq.prepare("INSERT INTO listing_trial_terms(listing_id, hours, daily_fee, condition_note) VALUES(?, '[24]', 1000, ?)").run(t.listing, `조건${mk}`);
  sq.prepare("INSERT INTO listing_components(id, listing_id, name) VALUES(?, ?, '충전기')").run(id(), t.listing);
  t.order = id();
  const snap = { title: `상품${mk}`, price: 1000, conditionGrade: "A", description: `설명${mk}`, components: ["충전기"], photo: t.lphoto, brand: "B", modelName: "M", modelId: MODEL, category: "노트북", conditionNote: `조건${mk}`,
    checks: [{ key: "battery", label: "배터리 성능", value: "90% 이상" }, { key: "zzz", label: "메모", value: `점검${mk}` }] };
  t.bphoto = photoFile("order", `BPHOTO${mk}`); t.sphoto = photoFile("order", `SPHOTO${mk}`);
  sq.prepare(`INSERT INTO orders(id, listing_id, buyer_id, seller_id, kind, status, snapshot, price, deposit_name, ship_enc, refund_enc, questions, ship_tracking, return_tracking, return_note,
    inspection, arrival_check, pack_check, cancel_reason, seller_account_enc, completed_at) VALUES(?, ?, ?, ?, 'TRIAL', 'PURCHASED', ?, 1000, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(t.order, t.listing, b, s, JSON.stringify(snap), `입금${mk}`, `v1.ship${mk}`, `v1.refund${mk}`, JSON.stringify([`질문${mk}`]), `송장${mk}`, `반송${mk}`, `반품메모${mk}`,
      JSON.stringify({ items: [{ name: "충전기", ok: true }], condition: "DAMAGED", note: `검수메모${mk}`, photos: [t.sphoto] }),
      JSON.stringify({ items: [{ name: "충전기", ok: true }], matches: false, note: `받음메모${mk}`, photos: [t.bphoto] }),
      JSON.stringify({ items: [{ name: "충전기", ok: true }], reset: null, note: `포장메모${mk}`, photos: [] }), `취소${mk}`, `v1.acct${mk}`, opt.completed ?? "2026-01-01 00:00:00");
  sq.prepare("INSERT INTO order_photos(id, order_id, stage, user_id, file_name, width, height) VALUES(?, ?, 'RECEIVE', ?, ?, 10, 10)").run(id(), t.order, b, t.bphoto);
  sq.prepare("INSERT INTO order_photos(id, order_id, stage, user_id, file_name, width, height) VALUES(?, ?, 'INSPECT', ?, ?, 10, 10)").run(id(), t.order, s, t.sphoto);
  t.ev = id();
  sq.prepare("INSERT INTO order_events(id, order_id, actor_id, type, data) VALUES(?, ?, ?, 'CANCELLED', ?)").run(t.ev, t.order, b, JSON.stringify({ by: "buyer", reason: `이유${mk}` }));
  t.thread = id(); t.thread2 = id();
  sq.prepare("INSERT INTO chat_threads(id, listing_id, buyer_id, seller_id) VALUES(?, ?, ?, ?)").run(t.thread, t.listing, b, s);
  sq.prepare("INSERT INTO chat_threads(id, listing_id, buyer_id, seller_id) VALUES(?, ?, ?, ?)").run(t.thread2, t.listing2, b, s);
  const msg = (th: string, who: string, body: string, kind = "USER") => { const m = id(); sq.prepare("INSERT INTO chat_messages(id, seq, thread_id, sender_id, body, kind) VALUES(?, ?, ?, ?, ?, ?)").run(m, seq++, th, who, body, kind); return m; };
  msg(t.thread, b, `구매자말${mk}`); msg(t.thread, s, `판매자말${mk}`);
  t.sysMsg = msg(t.thread, "sys_sseoboni", `[거래] 구매자가 받은 물건을 확인했어요: 설명과 다름 — 받음메모${mk}. / 상태: 손상 — 검수메모${mk}`, "SYSTEM");
  msg(t.thread2, b, `노주문구매자${mk}`); msg(t.thread2, s, `노주문판매자${mk}`);
  t.dispute = id();
  if (opt.dispute !== false) sq.prepare("INSERT INTO disputes(id, order_id, opener_id, reason, detail, status, resolved_at) VALUES(?, ?, ?, 'X', ?, 'RESOLVED', '2026-01-02 00:00:00')").run(t.dispute, t.order, b, `분쟁${mk}`);
  t.rev = id(); t.trev = id();
  sq.prepare("INSERT INTO reviews(id, order_id, writer_id, target_id, direction, stars, chips, body) VALUES(?, ?, ?, ?, 'B2S', 9, '[]', ?)").run(t.rev, t.order, b, s, `연락 010-1234-5678 주세요${mk}`);
  sq.prepare("INSERT INTO trial_reviews(id, order_id, writer_id, model_id, outcome, hours, reason, learned) VALUES(?, ?, ?, ?, 'PURCHASED', 24, ?, '좋아요')").run(t.trev, t.order, b, MODEL, `카톡 아이디 abc${mk}`);
  t.fb = id(); t.rep = id(); t.ll = id();
  sq.prepare("INSERT INTO market_validation_events(id, event_type, user_id, metadata) VALUES(?, 'FEEDBACK', ?, ?)").run(t.fb, b, JSON.stringify({ reason: "기타", message: `의견${mk}` }));
  sq.prepare("INSERT INTO market_validation_events(id, event_type, user_id, metadata) VALUES(?, 'CHAT_REPORT', ?, ?)").run(t.rep, s, JSON.stringify({ threadId: t.thread, reportedUserId: b }));
  sq.prepare("INSERT INTO market_validation_events(id, event_type, user_id, metadata) VALUES(?, 'LOGIN_LINK_ISSUED', NULL, ?)").run(t.ll, JSON.stringify({ userId: b, expiresAt: "x" }));
  return t;
}
// 상대방(제3자) 알림: 탈퇴 판매자 상품 제목이 든 것
function counterpartNote(to: string, t: Trade): string {
  const n = id();
  sq.prepare("INSERT INTO notifications(id, user_id, category, title, body, url, deliver_after) VALUES(?, ?, 'INTEREST', ?, ?, ?, 'x')").run(n, to, `찜한 상품 · 상품${t.mk}`, `상품${t.mk} 가격이 내렸어요`, `/listings/${t.listing}`);
  return n;
}
const get = <T>(q: string, ...p: unknown[]) => sq.prepare(q).get(...p) as T;
const stage = (u: string) => get<{ stage: string } | undefined>("SELECT stage FROM withdrawals WHERE user_id = ?", u)?.stage ?? null;
const rcount = (u: string) => (retainedDb().prepare("SELECT (SELECT COUNT(*) FROM retained_values WHERE withdrawn_user_id = ?) + (SELECT COUNT(*) FROM retained_files WHERE withdrawn_user_id = ?) n").get(u, u) as { n: number }).n;
const rval = (u: string, t: string, sid: string, col: string) => { const r = retainedDb().prepare("SELECT box FROM retained_values WHERE withdrawn_user_id = ? AND src_table = ? AND src_id = ? AND col = ?").get(u, t, sid, col) as { box: string } | undefined; return r ? retainOpen(r.box) : null; };
// param: mk. return: 운영 DB 모든 표·모든 TEXT 칸에서 표식이 든 칸 목록
function markerHits(mk: string): string[] {
  const out: string[] = [];
  for (const { name } of sq.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]) {
    for (const c of sq.prepare(`PRAGMA table_info("${name}")`).all() as { name: string; type: string }[]) {
      if (!/text/i.test(c.type)) continue;
      const n = (sq.prepare(`SELECT COUNT(*) n FROM "${name}" WHERE instr("${c.name}", ?) > 0`).get(mk) as { n: number }).n;
      if (n > 0) out.push(`${name}.${c.name}=${n}`);
    }
  }
  return out;
}
const bytesHave = (file: string, mk: string) => fs.existsSync(file) && fs.readFileSync(file).includes(Buffer.from(mk, "utf8"));
const withdrawAndRetain = (u: string) => { const w = withdrawUser(u); return { w, r: "ok" in w ? retainUser(u, NOW) : null }; };

async function main() {
  // ── T33 사전 점검 ──
  useRt("t33");
  check("T33 비밀값·폴더 정상 → 준비됨", retainReady().ok === true);
  const sec = process.env.RETAIN_SECRET;
  delete process.env.RETAIN_SECRET; check("T33 RETAIN_SECRET 없음 → 준비 안 됨", retainReady().ok === false);
  process.env.RETAIN_SECRET = "x".repeat(31); check("T33 31자 → 준비 안 됨", retainReady().ok === false);
  process.env.RETAIN_SECRET = sec;
  closeRetained(); fs.rmSync(rtDir("retained"), { recursive: true, force: true }); fs.writeFileSync(rtDir("retained"), "파일이라 폴더를 못 만듦");
  check("T33 보관 폴더 쓰기 불가 → 준비 안 됨", retainReady().ok === false);

  // ── T15·T16·T26·T22b·T21 구매자·판매자 탈퇴 ──
  useRt("main");
  const S = user(), B = user(), C = user();
  const mk = `MK${hex(6)}`;
  const t = makeTrade(S, B, mk);
  const cn = counterpartNote(C, t);
  sq.prepare("INSERT INTO notifications(id, user_id, category, title, body, url, deliver_after) VALUES(?, ?, 'CHAT', ?, ?, ?, 'x')").run(id(), C, `새 채팅 · 상품${mk}`, "x", `/chats/${t.thread}`);
  const snapBefore = JSON.parse(get<{ snapshot: string }>("SELECT snapshot FROM orders WHERE id = ?", t.order).snapshot);
  const etag = `"${t.lphoto}"`;
  const preq = (h: Record<string, string> = {}) => photoGET(new NextRequest(`http://x/api/photos/${t.lphoto}?v=2`, { headers: h }), { params: Promise.resolve({ file: t.lphoto }) });
  const p1 = await preq();
  check("T21b 탈퇴 전 사진 200·ETag·no-cache", p1.status === 200 && p1.headers.get("etag") === etag && p1.headers.get("cache-control") === "private, no-cache, must-revalidate", `${p1.status} ${p1.headers.get("cache-control")}`);
  check("T21b 탈퇴 전 두 번째 요청(If-None-Match) 304", (await preq({ "if-none-match": etag })).status === 304);

  const rb = withdrawAndRetain(B);
  check("T15 구매자 탈퇴·보관 이동 → RETAINED", rb.r === "RETAINED" && stage(B) === "RETAINED", `${rb.r} ${stage(B)}`);
  const o = get<Record<string, string | null>>("SELECT * FROM orders WHERE id = ?", t.order);
  const t15 = { questions: o.questions === null, return_note: o.return_note === null, deposit_name: o.deposit_name === "탈퇴한 사용자", ship_enc: o.ship_enc === "", refund_enc: o.refund_enc === null,
    return_tracking: o.return_tracking === null, cancel_reason: o.cancel_reason === null, arrival: JSON.parse(o.arrival_check!).note === "" && JSON.parse(o.arrival_check!).photos.length === 0 && JSON.parse(o.arrival_check!).items.length === 1,
    pack: JSON.parse(o.pack_check!).note === "", ship_tracking_kept: o.ship_tracking === `송장${mk}` };
  check("T15 구매자 칸 10개 비움(판매자 칸 ship_tracking은 남음)", Object.values(t15).every(Boolean), JSON.stringify(t15));
  const t16 = { q: rval(B, "orders", t.order, "questions") === JSON.stringify([`질문${mk}`]), dep: rval(B, "orders", t.order, "deposit_name") === `입금${mk}`, ship: rval(B, "orders", t.order, "ship_enc") === `v1.ship${mk}`,
    cancel: rval(B, "orders", t.order, "cancel_reason") === `취소${mk}`, ev: rval(B, "order_events", t.ev, "data")?.includes(`이유${mk}`) === true, disp: rval(B, "disputes", t.dispute, "detail") === `분쟁${mk}`,
    sys: rval(B, "chat_messages", t.sysMsg, "body")?.includes(`받음메모${mk}`) === true };
  check("T16 보관값 복호화 = 원래 값(7개 표본)", Object.values(t16).every(Boolean), JSON.stringify(t16));
  const box = (retainedDb().prepare("SELECT box FROM retained_values WHERE withdrawn_user_id = ? LIMIT 1").get(B) as { box: string }).box;
  check("T16 보관 DB에는 암호문만(r1. 형식, 평문 표식 없음)", box.startsWith("r1.") && !bytesHave(rtDir("retained.db"), mk));
  const bfile = retainedDb().prepare("SELECT state, missing, src_removed FROM retained_files WHERE withdrawn_user_id = ? AND file_name = ?").get(B, t.bphoto) as { state: string; missing: number; src_removed: number } | undefined;
  check("T16 구매자 거래 사진 보관(OK)·원본 삭제·복호화", bfile?.state === "OK" && bfile.src_removed === 1 && !fs.existsSync(rtDir("order-uploads", t.bphoto))
    && retainOpenFile(fs.readFileSync(rtDir("retained", `order-${t.bphoto}.r1`)))?.toString() === `BPHOTO${mk}`);
  // T26
  const sysBody = get<{ body: string }>("SELECT body FROM chat_messages WHERE id = ?", t.sysMsg).body;
  const t26 = {
    noOrderRoom: get<{ body: string }>("SELECT body FROM chat_messages WHERE thread_id = ? AND sender_id = ?", t.thread2, B).body === WITHDRAWN_MSG,
    orderRoom: get<{ body: string }>("SELECT body FROM chat_messages WHERE thread_id = ? AND sender_id = ?", t.thread, B).body === WITHDRAWN_MSG,
    review: get<{ body: string | null }>("SELECT body FROM reviews WHERE id = ?", t.rev).body === null,
    trialReview: get<{ reason: string | null; learned: string }>("SELECT reason, learned FROM trial_reviews WHERE id = ?", t.trev).reason === null,
    trialReviewKept: get<{ learned: string }>("SELECT learned FROM trial_reviews WHERE id = ?", t.trev).learned === "좋아요",
    feedback: JSON.parse(get<{ metadata: string }>("SELECT metadata FROM market_validation_events WHERE id = ?", t.fb).metadata).message === null,
    report: /^wd_[0-9a-f]{32}$/.test(JSON.parse(get<{ metadata: string }>("SELECT metadata FROM market_validation_events WHERE id = ?", t.rep).metadata).reportedUserId),
    loginLink: /^wd_/.test(JSON.parse(get<{ metadata: string }>("SELECT metadata FROM market_validation_events WHERE id = ?", t.ll).metadata).userId),
    sysMemo: sysBody.includes(WITHDRAWN_MEMO) && !sysBody.includes(`받음메모${mk}`) && sysBody.includes(`검수메모${mk}`),
    cancelEvent: JSON.parse(get<{ data: string }>("SELECT data FROM order_events WHERE id = ?", t.ev).data).reason === "",
    sellerMsgKept: get<{ body: string }>("SELECT body FROM chat_messages WHERE thread_id = ? AND sender_id = ?", t.thread, S).body === `판매자말${mk}`,
  };
  check("T26 주문 없는 방·후기 연락처·의견·신고/링크 가명·SYSTEM 메모·취소 사유 (11칸)", Object.values(t26).every(Boolean), JSON.stringify(t26));

  const rs = withdrawAndRetain(S);
  check("T17e 판매자도 탈퇴 → RETAINED", rs.r === "RETAINED", String(rs.r));
  check("T17e 구매자 첫 보관값(cancel_reason) 그대로", rval(B, "orders", t.order, "cancel_reason") === `취소${mk}`);
  check("T17e 판매자 쪽에는 cancel_reason 보관 없음(이미 빈 값)", rval(S, "orders", t.order, "cancel_reason") === null);
  const snapAfter = JSON.parse(get<{ snapshot: string }>("SELECT snapshot FROM orders WHERE id = ?", t.order).snapshot);
  const same = ["price", "conditionGrade", "components", "brand", "modelName", "modelId", "category"].every((k) => JSON.stringify(snapBefore[k]) === JSON.stringify(snapAfter[k]));
  check("T22b 스냅숏: 바꾼 칸 밖 7항목 전후 같음, 판매자 칸만 바뀜", same && snapAfter.title === WITHDRAWN_LISTING && snapAfter.description === "" && snapAfter.photo === null && snapAfter.conditionNote === null
    && snapAfter.checks[0].value === "90% 이상" && snapAfter.checks[1].value === "", JSON.stringify(snapAfter));
  check("T22b 원래 스냅숏 전체는 보관 DB에", rval(S, "orders", t.order, "snapshot") === JSON.stringify(snapBefore));
  const lst = get<{ title: string; description: string; check_items: string | null }>("SELECT title, description, check_items FROM listings WHERE id = ?", t.listing);
  check("K1 판매자 상품 내용 비움", lst.title === WITHDRAWN_LISTING && lst.description === "" && lst.check_items === null);
  const p2 = await preq({ "if-none-match": etag });
  check("T21·T21b 탈퇴 뒤 같은 ETag 요청 → 404(304 아님)", p2.status === 404, String(p2.status));
  check("T21 탈퇴 뒤 사진 주소 → 404", (await preq()).status === 404);
  const note = get<{ title: string; body: string }>("SELECT title, body FROM notifications WHERE id = ?", cn);
  check("3절 상대방 알림 제목·본문의 상품 제목 교체", note.title === `찜한 상품 · ${WITHDRAWN_LISTING}` && !note.body.includes(mk), JSON.stringify(note));
  const hits = markerHits(mk);
  check("T32 운영 DB 모든 표·TEXT 칸에서 표식 0건(양쪽 탈퇴 뒤)", hits.length === 0, hits.join(", "));
  sq.pragma("wal_checkpoint(TRUNCATE)");
  check("T24 운영 DB 파일·-wal 바이트에 표식 없음", !bytesHave(dbPath, mk) && !bytesHave(`${dbPath}-wal`, mk), `db=${bytesHave(dbPath, mk)} wal=${bytesHave(`${dbPath}-wal`, mk)}`);
  check("T24 원본 사진 폴더에 표식 파일 없음", ![t.lphoto, t.bphoto, t.sphoto].some((f) => fs.existsSync(rtDir("uploads", f)) || fs.existsSync(rtDir("order-uploads", f))));

  // ── T18·T19·T20 트리거 쌍 ──
  const A = user(), W = user(), B2 = user();
  const LA = id(), LW = id(), LWS = id(), OA = id(), TH = id();
  sq.prepare("INSERT INTO listings(id, seller_id, model_id, title, price, condition_grade, description, status) VALUES(?, ?, ?, 'a', 1, 'A', 'a', 'ACTIVE')").run(LA, A, MODEL);
  sq.prepare("INSERT INTO listings(id, seller_id, model_id, title, price, condition_grade, description, status) VALUES(?, ?, ?, 'w', 1, 'A', 'w', 'REMOVED')").run(LW, W, MODEL);
  sq.prepare("INSERT INTO listings(id, seller_id, model_id, title, price, condition_grade, description, status) VALUES(?, ?, ?, 'ws', 1, 'A', 'ws', 'SOLD')").run(LWS, W, MODEL);
  sq.prepare("INSERT INTO listing_trial_terms(listing_id, hours, daily_fee, condition_note) VALUES(?, '[24]', 1, 'n')").run(LW);
  sq.prepare("INSERT INTO orders(id, listing_id, buyer_id, seller_id, kind, status, snapshot, price, deposit_name, ship_enc) VALUES(?, ?, ?, ?, 'BUY', 'PURCHASED', '{}', 1, 'd', 's')").run(OA, LA, B2, A);
  sq.prepare("INSERT INTO chat_threads(id, listing_id, buyer_id, seller_id) VALUES(?, ?, ?, ?)").run(TH, LA, B2, A);
  sq.prepare("UPDATE users SET status = 'WITHDRAWN', nickname = '탈퇴한 사용자', kakao_image_url = NULL, show_photo = 0 WHERE id = ?").run(W);
  const tryW = (q: string, ...p: unknown[]): string => {
    sq.exec("SAVEPOINT t18");
    try { sq.prepare(q).run(...p); return "ok"; } catch (e) { return String((e as Error).message); } finally { sq.exec("ROLLBACK TO t18; RELEASE t18"); }
  };
  const pairs: [string, string, (u: string) => unknown[]][] = [
    ["wishlists", "INSERT INTO wishlists(id, user_id, listing_id) VALUES(?, ?, ?)", (u) => [id(), u, LA]],
    ["demand_intents", "INSERT INTO demand_intents(id, user_id, model_id, intent_type) VALUES(?, ?, ?, 'WANT_TO_TRY')", (u) => [id(), u, MODEL]],
    ["seller_accounts", "INSERT INTO seller_accounts(user_id, bank, account_enc, holder) VALUES(?, 'b', 'a', 'h')", (u) => [u]],
    ["push_subscriptions", "INSERT INTO push_subscriptions(endpoint, user_id, p256dh, auth) VALUES(?, ?, 'p', 'a')", (u) => [id(), u]],
    ["notification_prefs", "INSERT INTO notification_prefs(user_id) VALUES(?)", (u) => [u]],
    ["notifications", "INSERT INTO notifications(id, user_id, category, title, body, url, deliver_after) VALUES(?, ?, 'TRADE', 't', 'b', '/', 'x')", (u) => [id(), u]],
    ["login_links", "INSERT INTO login_links(token_hash, user_id, expires_at) VALUES(?, ?, 'x')", (u) => [id(), u]],
    ["social_accounts", "INSERT INTO social_accounts(provider, provider_user_id, user_id) VALUES('KAKAO', ?, ?)", (u) => [id(), u]],
    ["chat_messages", "INSERT INTO chat_messages(id, seq, thread_id, sender_id, body, kind) VALUES(?, ?, ?, ?, 'm', 'USER')", (u) => [id(), seq++, TH, u]],
    ["chat_threads", "INSERT INTO chat_threads(id, listing_id, buyer_id, seller_id) VALUES(?, ?, ?, ?)", (u) => [id(), LA, u, A]],
    ["trial_proposals", "INSERT INTO trial_proposals(id, listing_id, buyer_id, hours, offer_fee) VALUES(?, ?, ?, 24, 1)", (u) => [id(), LA, u]],
    ["orders", "INSERT INTO orders(id, listing_id, buyer_id, seller_id, kind, status, snapshot, price, deposit_name, ship_enc) VALUES(?, ?, ?, ?, 'BUY', 'PAID', '{}', 1, 'd', 's')", (u) => [id(), LA, u, A]],
    ["order_photos", "INSERT INTO order_photos(id, order_id, stage, user_id, file_name, width, height) VALUES(?, ?, 'RECEIVE', ?, 'f', 1, 1)", (u) => [id(), OA, u]],
    ["disputes", "INSERT INTO disputes(id, order_id, opener_id, reason) VALUES(?, ?, ?, 'r')", (u) => [id(), OA, u]],
    ["reviews", "INSERT INTO reviews(id, order_id, writer_id, target_id, direction, stars, chips) VALUES(?, ?, ?, ?, 'B2S', 5, '[]')", (u) => [id(), OA, u, A]],
    ["trial_reviews", "INSERT INTO trial_reviews(id, order_id, writer_id, model_id, outcome, hours) VALUES(?, ?, ?, ?, 'PURCHASED', 24)", (u) => [id(), OA, u, MODEL]],
    ["xp_awards", "INSERT INTO xp_awards(id, user_id, order_id, role, kind) VALUES(?, ?, ?, 'BUYER', 'TRADE_DONE')", (u) => [id(), u, OA]],
    ["listings(INSERT)", "INSERT INTO listings(id, seller_id, model_id, title, price, condition_grade, description) VALUES(?, ?, ?, 't', 1, 'A', 'd')", (u) => [id(), u, MODEL]],
    ["market_validation_events(INSERT)", "INSERT INTO market_validation_events(id, event_type, user_id) VALUES(?, 'VIEW_LISTING', ?)", (u) => [id(), u]],
  ];
  let t18ok = 0;
  for (const [name, q, args] of pairs) {
    const a = tryW(q, ...args(A)), w = tryW(q, ...args(W));
    const ok = a === "ok" && w === "USER_INACTIVE";
    if (ok) t18ok++;
    check(`T18 ${name}: ACTIVE 성공·탈퇴자 USER_INACTIVE`, ok, `A=${a} W=${w}`);
  }
  // 상품 소속 표(상품 판매자 기준)
  for (const [name, q, l] of [
    ["listing_photos", "INSERT INTO listing_photos(id, listing_id, file_name, width, height) VALUES(?, ?, 'f', 1, 1)", true],
    ["listing_components", "INSERT INTO listing_components(id, listing_id, name) VALUES(?, ?, 'c')", true],
  ] as const) {
    const a = tryW(q, id(), LA), w = tryW(q, id(), LW);
    if (a === "ok" && w === "USER_INACTIVE" && l) t18ok++;
    check(`T18 ${name}: ACTIVE 상품 성공·탈퇴자 상품 USER_INACTIVE`, a === "ok" && w === "USER_INACTIVE", `A=${a} W=${w}`);
  }
  const lta = tryW("INSERT INTO listing_trial_terms(listing_id, hours, daily_fee) VALUES(?, '[24]', 1)", LA), ltw = tryW("INSERT INTO listing_trial_terms(listing_id, hours, daily_fee) VALUES(?, '[24]', 1)", LWS);
  check("T18 listing_trial_terms INSERT 쌍", lta === "ok" && ltw === "USER_INACTIVE", `${lta} ${ltw}`);
  const ltu1 = tryW("UPDATE listing_trial_terms SET hours = '[48]' WHERE listing_id = ?", LW), ltu2 = tryW("UPDATE listing_trial_terms SET condition_note = NULL WHERE listing_id = ?", LW);
  check("T18 listing_trial_terms UPDATE: 탈퇴자 조건 변경 거절·메모 비우기 통과", ltu1 === "USER_INACTIVE" && ltu2 === "ok", `${ltu1} ${ltu2}`);
  const lsA = tryW("UPDATE listings SET status = 'HIDDEN' WHERE id = ?", LA), lsW = tryW("UPDATE listings SET status = 'ACTIVE' WHERE id = ?", LW);
  check("T18 listings UPDATE 상태: ACTIVE 판매자 성공·탈퇴자 상품 되살리기 거절", lsA === "ok" && lsW === "USER_INACTIVE", `${lsA} ${lsW}`);
  check("T19 탈퇴자 SOLD 상품 내용 비우기 통과", tryW("UPDATE listings SET title = ?, description = '' WHERE id = ?", WITHDRAWN_LISTING, LWS) === "ok");
  check("T19 탈퇴자 REMOVED 유지 갱신 통과", tryW("UPDATE listings SET description = '' WHERE id = ?", LW) === "ok");
  sq.prepare("INSERT INTO withdrawals(user_id, stage) VALUES(?, 'RETAINED')").run(W);
  const lr1 = tryW("UPDATE listings SET title = '원래 제목' WHERE id = ?", LWS), lr2 = tryW("UPDATE listings SET title = ?, description = '', check_items = NULL WHERE id = ?", WITHDRAWN_LISTING, LWS);
  check("T18b RETAINED 뒤 원래 제목 되돌리기 거절·비운 값 갱신 통과", lr1 === "USER_INACTIVE" && lr2 === "ok", `${lr1} ${lr2}`);
  check("T18b ACTIVE 판매자 상품 제목 수정은 통과", tryW("UPDATE listings SET title = 'b' WHERE id = ?", LA) === "ok");
  const mw = tryW("INSERT INTO market_validation_events(id, event_type, user_id) VALUES(?, 'X', ?)", id(), `wd_${hex(4)}`), mn = tryW("INSERT INTO market_validation_events(id, event_type, user_id) VALUES(?, 'X', NULL)", id());
  const mu = tryW("UPDATE market_validation_events SET user_id = ? WHERE id = ?", W, t.fb);
  check("T18 market_validation_events: wd_ 가명·null 통과, 탈퇴자 id로 UPDATE 거절", mw === "ok" && mn === "ok" && mu === "USER_INACTIVE", `${mw} ${mn} ${mu}`);
  check("T18 chat_messages SYSTEM 종류는 탈퇴자 sender여도 통과", tryW("INSERT INTO chat_messages(id, seq, thread_id, sender_id, body, kind) VALUES(?, ?, ?, ?, 'm', 'SYSTEM')", id(), seq++, TH, W) === "ok");
  const u1 = tryW("UPDATE users SET nickname = '되살림' WHERE id = ?", W), u2 = tryW("UPDATE users SET status = 'ACTIVE' WHERE id = ?", W), u3 = tryW("UPDATE users SET kakao_image_url = 'x' WHERE id = ?", W), u4 = tryW("UPDATE users SET nickname = 'ok' WHERE id = ?", A);
  check("T20 탈퇴 뒤 이름·상태·사진 되돌리기 거절, ACTIVE 이름 바꾸기 통과", u1 === "USER_INACTIVE" && u2 === "USER_INACTIVE" && u3 === "USER_INACTIVE" && u4 === "ok", `${u1} ${u2} ${u3} ${u4}`);
  check(`T18 사용자 칸 17개 표 + 상품 소속 2개 쌍 통과 수 ${t18ok}/21`, t18ok === 21);
  // 사용자 id 칸이 있는 표가 모두 트리거를 갖는지(없으면 개인정보 없는 표 목록에 있어야 함)
  const trig = new Set((sq.prepare("SELECT tbl_name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'wd_%'").all() as { tbl_name: string }[]).map((r) => r.tbl_name));
  const exempt = new Set(["seller_profiles", "buyer_profiles", "withdrawals"]);
  const uncovered: string[] = [];
  for (const { name } of sq.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]) {
    const cols = (sq.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[]).map((c) => c.name);
    if (cols.some((c) => ["user_id", "buyer_id", "seller_id", "sender_id", "opener_id", "writer_id"].includes(c)) && !trig.has(name) && !exempt.has(name)) uncovered.push(name);
  }
  check(`T18 사용자 id 칸이 있는 표 전부 트리거(23개 트리거 표 ${trig.size}개, 예외 buyer/seller_profiles)`, uncovered.length === 0 && trig.size === 23, uncovered.join(","));

  // ── T17a~d·f·g 상태기계 중단·재시도 ──
  const ctrlS = user(), ctrlB = user();
  makeTrade(ctrlS, ctrlB, `C${hex(4)}`);
  withdrawAndRetain(ctrlB);
  const N = rcount(ctrlB);
  for (const step of [1, 2, 3]) {
    const s2 = user(), b2 = user();
    const m2 = `I${step}${hex(4)}`;
    const tr = makeTrade(s2, b2, m2);
    withdrawUser(b2);
    withdrawHooks.afterStep = (n) => { if (n === step) throw new Error(`멈춤${n}`); };
    let threw = false;
    try { retainUser(b2, NOW); } catch { threw = true; }
    withdrawHooks.afterStep = undefined;
    const mid = stage(b2);
    retainPending(NOW + 6 * 60_000); // 처리 중 표시 5분이 지난 뒤 정기 작업 1회
    check(`T17${"abc"[step - 1]} ${["①", "②", "③"][step - 1]} 뒤 멈춤 → 정기 작업 1회 → RETAINED, 보관 ${N}줄(누락·중복 없음), 값 복원`,
      threw && mid === "RETAINING" && stage(b2) === "RETAINED" && rcount(b2) === N && rval(b2, "orders", tr.order, "deposit_name") === `입금${m2}`, `threw=${threw} mid=${mid} now=${stage(b2)} n=${rcount(b2)}/${N}`);
  }
  {
    const s2 = user(), b2 = user(); makeTrade(s2, b2, `D${hex(4)}`); withdrawUser(b2);
    let nested: string | null = null;
    withdrawHooks.afterStep = (n) => { if (n === 1) nested = retainUser(b2, NOW); };
    const first = retainUser(b2, NOW);
    withdrawHooks.afterStep = undefined;
    check("T17d 진행 중 두 번째 retainUser → 잠금에 막힘(LOCKED), 첫 실행만 완료", nested === "LOCKED" && first === "RETAINED", `${nested} ${first}`);
    const s3 = user(), b3 = user(); makeTrade(s3, b3, `E${hex(4)}`); withdrawUser(b3);
    sq.prepare("UPDATE withdrawals SET stage = 'RETAINING', lease_owner = 'other', lease_until = ? WHERE user_id = ?").run(NOW + 60_000, b3);
    check("T17d 다른 실행의 처리 중 표시(기한 안) → BUSY, ②에 안 들어감(보관 0줄)", retainUser(b3, NOW) === "BUSY" && rcount(b3) === 0);
    check("T17d 기한 지난 처리 중 표시 → 이어받아 RETAINED", retainUser(b3, NOW + 2 * 60_000) === "RETAINED");
  }
  {
    const s2 = user(), b2 = user(); const tr = makeTrade(s2, b2, `G${hex(4)}`); withdrawUser(b2);
    withdrawHooks.afterStep = (n) => { if (n === 3) sq.prepare("UPDATE withdrawals SET lease_owner = 'newer' WHERE user_id = ?").run(b2); };
    let msg = "";
    try { retainUser(b2, NOW); } catch (e) { msg = (e as Error).message; }
    withdrawHooks.afterStep = undefined;
    const o2 = get<{ deposit_name: string }>("SELECT deposit_name FROM orders WHERE id = ?", tr.order);
    check("T17g 늦게 끝난 옛 lease_owner의 ④ → 0줄(되돌림), 원래 칸 그대로", msg === "RETAIN_LEASE_LOST" && o2.deposit_name !== "탈퇴한 사용자" && stage(b2) === "RETAINING", `${msg} ${o2.deposit_name} ${stage(b2)}`);
  }
  {
    const s2 = user(), b2 = user(); const tr = makeTrade(s2, b2, `F${hex(4)}`);
    fs.rmSync(rtDir("order-uploads", tr.bphoto));
    const r = withdrawAndRetain(b2).r;
    const f = retainedDb().prepare("SELECT missing FROM retained_files WHERE withdrawn_user_id = ? AND file_name = ?").get(b2, tr.bphoto) as { missing: number } | undefined;
    check("T17f 원본 사진이 없어도 RETAINED, missing=1 기록", r === "RETAINED" && f?.missing === 1, `${r} ${f?.missing}`);
  }

  // ── T29 WAL 정리 실패 ──
  {
    const s2 = user(), b2 = user(); makeTrade(s2, b2, `W${hex(4)}`); withdrawUser(b2);
    const reader = new Database(dbPath, { readonly: true });
    reader.pragma("busy_timeout = 0");
    reader.exec("BEGIN"); reader.prepare("SELECT COUNT(*) FROM orders").get();
    sq.pragma("busy_timeout = 100");
    const r1 = retainUser(b2, NOW);
    check("T29 읽기 연결이 열려 있으면 WIPE_PENDING(busy=1)", r1 === "WIPE_PENDING" && stage(b2) === "WIPE_PENDING", r1);
    reader.exec("COMMIT"); reader.close();
    retainPending(NOW);
    check("T29 닫은 뒤 정기 작업 → RETAINED", stage(b2) === "RETAINED", String(stage(b2)));
  }

  // ── T27 스위치 꺼짐 ──
  {
    delete process.env.WITHDRAW_ENABLED;
    const r503 = await withdrawPOST(new NextRequest("http://x/api/me/withdraw", { method: "POST", body: JSON.stringify({ confirm: "x" }) }));
    check("T27 스위치 꺼짐 → 새 탈퇴 POST 503", r503.status === 503);
    const s2 = user(), b2 = user(); makeTrade(s2, b2, `K${hex(4)}`); withdrawUser(b2);
    retainPending(NOW);
    check("T27 스위치 꺼짐이어도 RETAIN_PENDING 처리", stage(b2) === "RETAINED");
  }

  // ── T30·T30b 보관 백업 세트 ──
  {
    const setName = backupRetained(NOW);
    const target = path.join(ROOT, "restore");
    fs.rmSync(target, { recursive: true, force: true });
    restoreSet(path.join(rtDir("retained-backups"), setName!), target);
    const rc = new Database(path.join(target, "retained.db"), { readonly: true });
    const boxB = rc.prepare("SELECT box FROM retained_values WHERE withdrawn_user_id = ? AND col = 'deposit_name'").get(B) as { box: string };
    const fileB = fs.readFileSync(path.join(target, "retained", `order-${t.bphoto}.r1`));
    rc.close();
    check("T30 세트로 새 폴더에 복원 → 목록 sha256 일치·복호화(값·사진)", retainOpen(boxB.box, path.join(target, "retained-keys")) === `입금${mk}` && retainOpenFile(fileB, path.join(target, "retained-keys"))?.toString() === `BPHOTO${mk}`);
    let during: string | null | undefined;
    const s2 = user(), b2 = user(); makeTrade(s2, b2, `O${hex(4)}`); withdrawUser(b2);
    withdrawHooks.afterStep = (n) => { if (n === 2) during = backupRetained(NOW); };
    retainUser(b2, NOW);
    withdrawHooks.afterStep = undefined;
    check("T30b 보관 이동 중 백업 시작 → 잠금에 막혀 겹치지 않음", during === null);
    const before = listSets().map((s) => s.name).sort().join(",");
    retainHooks.backupStep = (s) => { if (s === "copied") throw new Error("생성 실패"); };
    let bad = false; try { withRetainLock((l) => createBackupSet(l, NOW)); } catch { bad = true; }
    retainHooks.backupStep = undefined;
    check("T30b 새 세트 생성 실패 → tmp 지움, 옛 세트 그대로", bad && listSets().map((s) => s.name).sort().join(",") === before && !listSets().some((s) => s.tmp));
  }

  // ── T31·T31b·T31c 업로드 고아 ──
  {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#f00" } }).png().toBuffer();
    const sx = user(); const LX = id();
    sq.prepare("INSERT INTO listings(id, seller_id, model_id, title, price, condition_grade, description) VALUES(?, ?, ?, 't', 1, 'A', 'd')").run(LX, sx, MODEL);
    const s1 = await savePhoto(png);
    sq.prepare("UPDATE users SET status = 'WITHDRAWN', nickname = '탈퇴한 사용자', kakao_image_url = NULL, show_photo = 0 WHERE id = ?").run(sx); // 업로드 도중 탈퇴
    let insErr = "";
    try { sq.prepare("INSERT INTO listing_photos(id, listing_id, file_name, width, height) VALUES(?, ?, ?, 8, 8)").run(id(), LX, s1.fileName); } catch (e) { insErr = (e as Error).message; await discardStaged(s1.fileName); }
    const orphan = (f: string) => fs.existsSync(rtDir("staging", "listing", f)) || fs.existsSync(rtDir("uploads", f));
    check("T31 업로드 도중 탈퇴 → 줄 거절, 저장 파일 지움(고아 0)", insErr === "USER_INACTIVE" && !orphan(s1.fileName), insErr);
    const sy = user(); const LY = id();
    sq.prepare("INSERT INTO listings(id, seller_id, model_id, title, price, condition_grade, description) VALUES(?, ?, ?, 't', 1, 'A', 'd')").run(LY, sy, MODEL);
    const s2 = await savePhoto(png); // 저장 직후 서버 종료(줄 없음)
    const s3 = await savePhoto(png); // 줄 커밋 뒤 rename 전 종료
    sq.prepare("INSERT INTO listing_photos(id, listing_id, file_name, width, height) VALUES(?, ?, ?, 8, 8)").run(id(), LY, s3.fileName);
    const s4 = await savePhoto(png, "order"); // 거래 사진 staging 고아
    check("T31c 원래 폴더에 없으면 staging에서 읽음", (await readPhoto(s3.fileName)) !== null);
    cleanupUploadOrphans(NOW);
    check("T31c 커밋 뒤 종료 → 정기 작업이 원래 폴더로 옮김(지우지 않음)", fs.existsSync(rtDir("uploads", s3.fileName)) && !fs.existsSync(rtDir("staging", "listing", s3.fileName)));
    const g = await photoGET(new NextRequest(`http://x/api/photos/${s3.fileName}?v=2`), { params: Promise.resolve({ file: s3.fileName }) });
    check("T31c 주소 200", g.status === 200, String(g.status));
    check("T31b 24시간 전에는 줄 없는 staging 파일을 남김", fs.existsSync(rtDir("staging", "listing", s2.fileName)));
    const stray = `${hex(12)}.webp`; fs.writeFileSync(rtDir("order-uploads", stray), "x");
    cleanupUploadOrphans(NOW + 25 * H);
    const left = ["listing", "order"].flatMap((k) => fs.existsSync(rtDir("staging", k)) ? fs.readdirSync(rtDir("staging", k)) : []);
    check("T31b 24시간 뒤 정기 작업 → staging·order-uploads 고아 0(정상 사진은 남음)", left.length === 0 && !fs.existsSync(rtDir("order-uploads", stray)) && fs.existsSync(rtDir("uploads", s3.fileName)) && !fs.existsSync(rtDir("staging", "order", s4.fileName)), left.join(","));
    await commitPhoto("nope.webp"); // 안전하지 않은 이름은 무시
  }

  // ── T38 보관 사진 고아(S4) ──
  {
    const crashAt = async (label: string, hook: () => void, expectOk: boolean) => {
      const u = `t38_${hex(4)}`; const name = `${hex(12)}.webp`;
      fs.mkdirSync(rtDir("t38src"), { recursive: true });
      const src = rtDir("t38src", name); fs.writeFileSync(src, `T38${label}`); // 업로드 고아 정리 대상이 아닌 곳
      const req = { userId: u, kind: "listing" as const, srcId: "x", fileName: name, expiresMs: NOW + 400 * D, srcPaths: [src] };
      hook();
      try { withRetainLock((l) => putFile(l, req, NOW)); } catch { /* 멈춤 */ }
      retainHooks.fileStep = undefined; retainHooks.backupStep = undefined;
      cleanupOrphans(NOW + 25 * H);
      withRetainLock((l) => putFile(l, req, NOW)); // 상태기계가 다시 옮김
      cleanupOrphans(NOW + 25 * H);
      const rows = retainedDb().prepare("SELECT state FROM retained_files WHERE withdrawn_user_id = ?").all(u) as { state: string }[];
      const known = new Set((retainedDb().prepare("SELECT kind || '-' || file_name || '.r1' n FROM retained_files").all() as { n: string }[]).map((r) => r.n));
      const orphans = [...fs.readdirSync(rtDir("retained")).filter((f) => f.endsWith(".r1") && !known.has(f)), ...(fs.existsSync(rtDir("retained", "staging")) ? fs.readdirSync(rtDir("retained", "staging")) : [])];
      const dec = retainOpenFile(fs.readFileSync(rtDir("retained", `listing-${name}.r1`)))?.toString();
      check(`T38 ${label} 뒤 종료 → 정리 뒤 고아 0·복호화`, expectOk && rows.length === 1 && rows[0].state === "OK" && orphans.length === 0 && dec === `T38${label}` && !listSets().some((s) => s.tmp), `rows=${JSON.stringify(rows)} orphans=${orphans} dec=${dec}`);
    };
    await crashAt("staging 쓰기 직후", () => { retainHooks.fileStep = (n) => { if (n === 1) throw new Error("x"); }; }, true);
    await crashAt("줄 넣은 직후", () => { retainHooks.fileStep = (n) => { if (n === 2) throw new Error("x"); }; }, true);
    await crashAt("rename 직후", () => { retainHooks.fileStep = (n) => { if (n === 3) throw new Error("x"); }; }, true);
    // 임시 백업 만드는 도중: tmp 폴더를 남긴 채 종료 흉내
    fs.mkdirSync(path.join(rtDir("retained-backups"), `tmp-${NOW}-dead`), { recursive: true });
    fs.writeFileSync(path.join(rtDir("retained-backups"), `tmp-${NOW}-dead`, "retained.db"), "x");
    await crashAt("임시 백업 만드는 도중", () => undefined, true);
  }

  // ── T36 잠금 이어받기 경쟁(두 프로세스) ──
  {
    const lockDb = rtDir("retained.db");
    retainedDb().prepare("UPDATE locks SET owner = 'dead', until = ? WHERE name = 'retained'").run(NOW - 1);
    const old = (retainedDb().prepare("SELECT fence FROM locks WHERE name = 'retained'").get() as { fence: number }).fence;
    const start = Date.now() + 1500;
    const script = `const D=require(require.resolve("better-sqlite3",{paths:[${JSON.stringify(APP)}]}));const c=new D(${JSON.stringify(lockDb)});c.pragma("busy_timeout=5000");
      while(Date.now()<${start}){} const r=c.prepare("UPDATE locks SET owner=?, fence=fence+1, until=? WHERE name='retained' AND (owner IS NULL OR until<?) RETURNING fence").get("p"+process.pid, Date.now()+600000, Date.now());
      console.log(r?"GOT":"MISS");`;
    const run = () => new Promise<string>((res) => { const p = spawn(process.execPath, ["-e", script]); let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("close", () => res(o.trim())); });
    const outs = await Promise.all([run(), run()]);
    check("T36 두 프로세스가 기한 지난 잠금을 동시에 이어받음 → 정확히 하나만", outs.filter((x) => x === "GOT").length === 1, outs.join(","));
    const stale = { owner: "dead", fence: old, conn: retainedDb() };
    let lost = false;
    const before = (retainedDb().prepare("SELECT COUNT(*) n FROM key_registry").get() as { n: number }).n;
    try { retainTx(stale, () => retainedDb().prepare("INSERT INTO key_registry VALUES('stale', 'x', 0)").run()); } catch (e) { lost = e instanceof FenceLost; }
    const after = (retainedDb().prepare("SELECT COUNT(*) n FROM key_registry").get() as { n: number }).n;
    check("T36 옛 fence의 쓰기 0건(FenceLost)", lost && after === before);
    // T30c: 잠금을 남긴 채 재시작 → 10분 안에는 막히고, 기한이 지나면 다시 돈다
    const s2 = user(), b2 = user(); makeTrade(s2, b2, `L${hex(4)}`); withdrawUser(b2);
    retainedDb().prepare("UPDATE locks SET owner = 'crashed', until = ? WHERE name = 'retained'").run(NOW + 5 * 60_000);
    retainPending(NOW);
    const stuck = stage(b2);
    retainClock.now = () => Date.now() + 11 * 60_000; // 잠금 기한은 실제 시계로 잰다: 시계만 11분 뒤로
    retainPending(NOW + 11 * 60_000);
    retainClock.now = () => Date.now();
    check("T30c 남은 잠금: 기한 안 LOCKED, 10분 뒤 보관 이동 재개", stuck === "RETAIN_PENDING" && stage(b2) === "RETAINED", `${stuck} ${stage(b2)}`);
    retainedDb().prepare("UPDATE locks SET owner = NULL, until = NULL WHERE name = 'retained'").run();
    // 검수 1: 잠금 기한은 작업 시작 시각이 아니라 실제 시계로 잰다
    {
      const t0 = Date.now();
      const A = acquireRetainLock()!;
      const lu = () => (retainedDb().prepare("SELECT until FROM locks WHERE name = 'retained'").get() as { until: number }).until;
      retainClock.now = () => t0 + 9 * 60_000; // 9분 뒤 파일 작업 직전 → 실제 시각 기준으로 늘린다
      beforeFileOp(A);
      const extended = lu() >= t0 + 19 * 60_000;
      retainClock.now = () => t0 + 11 * 60_000;
      const blocked = acquireRetainLock() === null; // 늘렸으니 11분에도 다른 작업자는 못 얻는다
      check("검수1 9분 뒤 파일 작업 직전 기한을 실제 시각+10분으로 늘림 → 11분에 다른 작업자 잠금 실패", extended && blocked, `until=${lu() - t0}`);
      retainClock.now = () => t0 + 30 * 60_000; // 늘린 기한(19분)도 지난 뒤 다른 작업자가 이어받음
      const B = acquireRetainLock();
      const f = photoFile("listing", "LOCKCLOCK");
      const staged = () => fs.existsSync(rtDir("retained", "staging")) ? fs.readdirSync(rtDir("retained", "staging")).filter((x) => x.includes(f)).length : 0;
      const kept = () => fs.existsSync(rtDir("retained")) ? fs.readdirSync(rtDir("retained")).filter((x) => x.includes(f)).length : 0;
      let lostA = false;
      try { putFile(A, { userId: "lockclock", kind: "listing", srcId: "1", fileName: f, expiresMs: Date.UTC(2045, 0, 1), srcPaths: [rtDir("uploads", f)] }, NOW); } catch (e) { lostA = e instanceof FenceLost; }
      check("검수1 30분 뒤 다른 작업자가 잠금을 얻으면 옛 작업자의 파일 작업 0건(FenceLost, staging·보관 파일 0)", Boolean(B) && lostA && staged() === 0 && kept() === 0, `B=${Boolean(B)} lost=${lostA} ${staged()} ${kept()}`);
      if (B) releaseRetainLock(B);
      // 아무도 이어받지 않아도 기한이 지난 잠금으로는 파일 작업을 하지 않는다
      const C = acquireRetainLock()!;
      retainClock.now = () => t0 + 45 * 60_000;
      let lostC = false;
      try { beforeFileOp(C); } catch (e) { lostC = e instanceof FenceLost; }
      check("검수1 기한이 지난 내 잠금(이어받은 사람 없음)도 파일 작업 직전에 멈춤", lostC);
      retainClock.now = () => Date.now();
      retainedDb().prepare("UPDATE locks SET owner = NULL, until = NULL WHERE name = 'retained'").run();
    }
  }

  // ── T37 키 만들기 단계별 멈춤(S3) ──
  for (let n = 1; n <= 5; n++) {
    const keyId = keyIdFor(Date.UTC(2035, 0, n, 12));
    retainHooks.keyStep = (s) => { if (s === n) throw new Error("멈춤"); };
    try { withRetainLock((l) => ensureKey(l, keyId)); } catch { /* 멈춤 */ }
    retainHooks.keyStep = undefined;
    const kf = rtDir("retained-keys", `${keyId}.key`);
    const state = fs.existsSync(kf) ? (fs.readFileSync(kf).length === 32 ? "키 온전" : "키 손상") : "키 없음";
    const cipher = (retainedDb().prepare("SELECT COUNT(*) n FROM retained_values WHERE key_id = ?").get(keyId) as { n: number }).n;
    withRetainLock((l) => putValues(l, [{ userId: "t37", srcTable: "x", srcId: String(n), col: "c", value: `값${n}`, expiresMs: Date.UTC(2035, 0, n, 12) }], NOW));
    check(`T37 ${n}단계 뒤 멈춤 → (${state}, 암호문 ${cipher}) → 다시 실행 복호화`, state !== "키 손상" && cipher === 0 && rval("t37", "x", String(n), "c") === `값${n}`, state);
  }
  {
    const keyId = keyIdFor(Date.UTC(2036, 1, 1, 12));
    const tmps = () => fs.readdirSync(rtDir("retained-keys")).filter((f) => f.startsWith("tmp-")).length;
    const tmpBefore = tmps(); // T37 1·2단계 멈춤이 남긴 tmp(정기 정리 대상)
    let inner: Buffer | null = null;
    // 첫 실행이 tmp를 쓴 직후(등록 전) 두 번째 실행이 같은 key_id를 끝까지 만든다
    const outer = withRetainLock((l) => {
      retainHooks.keyStep = (s) => { if (s === 2 && !inner) { retainHooks.keyStep = undefined; inner = ensureKey(l, keyId); } };
      return ensureKey(l, keyId);
    });
    retainHooks.keyStep = undefined;
    const innerB = inner as Buffer | null;
    check("T23c 같은 key_id 동시 생성 → 같은 키(진 쪽은 자기 tmp를 버림)", Boolean(outer && innerB && outer.equals(innerB)) && tmps() === tmpBefore,
      `outer=${outer?.length} inner=${innerB?.length} files=${fs.readdirSync(rtDir("retained-keys")).join(",")}`);
    cleanupOrphans(NOW);
    check(`S4 키 폴더 tmp(멈춤 흔적 ${tmpBefore}개)는 잠금 안 정기 정리로 0개`, tmpBefore > 0 && tmps() === 0);
  }

  // ── T23·T23b·T35·T24 파기 ──
  useRt("purge");
  {
    const S3 = user(), B3 = user();
    const m3 = `P${hex(6)}`;
    const tr = makeTrade(S3, B3, m3, { completed: "2026-01-01 00:00:00" });
    withdrawAndRetain(B3); withdrawAndRetain(S3);
    const boxes = retainedDb().prepare("SELECT key_id, box FROM retained_values").all() as { key_id: string; box: string }[];
    const keys = [...new Set(boxes.map((b) => b.key_id))].sort();
    const photoKey = (retainedDb().prepare("SELECT key_id FROM retained_files WHERE file_name = ?").get(tr.bphoto) as { key_id: string }).key_id;
    // 상품(6개월)·거래(5년)·분쟁 상세(3년)·분쟁 사진(긴 쪽 5년)
    const exp = (k: string) => Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8));
    check("T23 키는 만료일별(상품 6개월·분쟁 3년·거래 5년 → 3개)", keys.length === 3 && keys.includes("20310101") && keys.includes("20290102"), keys.join(","));
    check("T23 분쟁 있는 주문 사진은 긴 쪽(5년) 키", photoKey === "20310101", photoKey);
    backupRetained(NOW);
    for (const k of keys) {
      const before = purgeRetained(exp(k) - D);
      const alive = retainedDb().prepare("SELECT COUNT(*) n FROM retained_values WHERE key_id = ?").get(k) as { n: number };
      const after = purgeRetained(exp(k) + D);
      const gone = (retainedDb().prepare("SELECT (SELECT COUNT(*) FROM retained_values WHERE key_id = ?) + (SELECT COUNT(*) FROM retained_files WHERE key_id = ?) n").get(k, k) as { n: number }).n;
      if (k === "20290102") check("T23 분쟁 3년+1일 뒤 분쟁 있는 주문 사진은 남음", fs.existsSync(rtDir("retained", `order-${tr.bphoto}.r1`)));
      check(`T23 ${k}: 기한 −1일 남음(${alive.n}줄), +1일 파기(줄·파일·키 0, 세트에도 0)`, before.done === 0 && alive.n > 0 && after.done === 1 && gone === 0 && !fs.existsSync(rtDir("retained-keys", `${k}.key`))
        && listSets().every((s) => !setKeyIds(s.dir).includes(k)), JSON.stringify({ before, after, gone }));
    }
    check("T23 분쟁 사진: 3년+1일에는 남고 5년+1일에 지워짐", !fs.existsSync(rtDir("retained", `order-${tr.bphoto}.r1`)));
    check("T24 파기 뒤 보관값 복호화 불가(키 파기)", boxes.every((b) => retainOpen(b.box) === null));
    sq.pragma("wal_checkpoint(TRUNCATE)");
    check("T24 파기 뒤 retained.db·dev.db·-wal 바이트에 표식 없음", ![rtDir("retained.db"), dbPath, `${dbPath}-wal`].some((f) => bytesHave(f, m3)));
    retainPending(Date.UTC(2032, 0, 1));
    check("2절 보관분이 모두 파기된 RETAINED 줄 삭제", stage(S3) === null && stage(B3) === null);
  }
  {
    // T23b: 같은 달 1일·31일
    const k1 = Date.UTC(2030, 0, 1, 12), k31 = Date.UTC(2030, 0, 31, 12);
    withRetainLock((l) => putValues(l, [{ userId: "b23", srcTable: "x", srcId: "1", col: "c", value: "일일", expiresMs: k1 }, { userId: "b23", srcTable: "x", srcId: "31", col: "c", value: "삼십일", expiresMs: k31 }], NOW));
    purgeRetained(Date.UTC(2030, 0, 2, 12));
    check("T23b 1일 파기 뒤 31일 기록 복호화 성공", rval("b23", "x", "1", "c") === null && rval("b23", "x", "31", "c") === "삼십일");
    // 이미 만료된 기록은 보관하지 않음
    const n = withRetainLock((l) => putValues(l, [{ userId: "old", srcTable: "x", srcId: "1", col: "c", value: "v", expiresMs: NOW - 2 * D }], NOW));
    check("S1 만료일이 이미 지난 기록은 보관하지 않음", n === 0 && rval("old", "x", "1", "c") === null);
  }
  {
    // T35: 각 단계 뒤 멈춤 → 다시 실행 → DONE, 옛 세트 삭제 실패 → LIVE 안 넘어감, 두 키 함께
    const mkv = (u: string, ms: number) => withRetainLock((l) => putValues(l, [{ userId: u, srcTable: "x", srcId: u, col: "c", value: u, expiresMs: ms }], NOW));
    const runs = () => retainedDb().prepare("SELECT key_id, stage FROM purge_runs").all() as { key_id: string; stage: string }[];
    for (const st of ["CANDIDATE_OK", "OLD_SETS_GONE", "LIVE_PURGED"]) {
      const ms = Date.UTC(2040, ["CANDIDATE_OK", "OLD_SETS_GONE", "LIVE_PURGED"].indexOf(st), 10, 12);
      const u = `t35${st}`; mkv(u, ms); mkv(`${u}keep`, Date.UTC(2050, 0, 1));
      backupRetained(NOW);
      retainHooks.purgeStage = (s) => { if (s === st) throw new Error("멈춤"); };
      try { purgeRetained(ms + D); } catch { /* 멈춤 */ }
      retainHooks.purgeStage = undefined;
      const mid = runs().find((r) => r.key_id === keyIdFor(ms))?.stage;
      const r2 = purgeRetained(ms + D);
      check(`T35 ${st} 뒤 멈춤(${mid}) → 다시 실행 → DONE, 다른 키 보관값 유지`, mid === st && r2.done >= 1 && runs().length === 0 && rval(u, "x", u, "c") === null && rval(`${u}keep`, "x", `${u}keep`, "c") === `${u}keep`, `${mid} ${JSON.stringify(r2)}`);
    }
    const ms = Date.UTC(2041, 0, 10, 12); mkv("t35del", ms);
    backupRetained(NOW);
    retainHooks.deleteSet = () => false;
    purgeRetained(ms + D);
    retainHooks.deleteSet = undefined;
    const st = runs().find((r) => r.key_id === keyIdFor(ms))?.stage;
    check("T35 옛 세트 삭제 실패 → LIVE_PURGED로 넘어가지 않음(실제 값 남음)", st === "CANDIDATE_OK" && rval("t35del", "x", "t35del", "c") === "t35del", String(st));
    const dep = backupRetained(NOW); // 파기 진행 중 배포 백업
    check("T35 파기 중 만든 배포 백업 세트에 만료 키 없음", !setKeyIds(path.join(rtDir("retained-backups"), dep!)).includes(keyIdFor(ms)));
    purgeRetained(ms + D);
    check("T35 실패 해소 뒤 다시 실행 → DONE", runs().length === 0 && rval("t35del", "x", "t35del", "c") === null);
    const ma = Date.UTC(2042, 0, 10, 12), mb = Date.UTC(2042, 0, 11, 12); mkv("t35a", ma); mkv("t35b", mb);
    backupRetained(NOW);
    let crossed = false;
    retainHooks.purgeStage = (s) => {
      if (s !== "CANDIDATE_OK") return;
      const cand = (retainedDb().prepare("SELECT candidate_set_id c FROM purge_runs LIMIT 1").get() as { c: string }).c;
      crossed = setKeyIds(path.join(rtDir("retained-backups"), cand)).some((k) => k === keyIdFor(ma) || k === keyIdFor(mb));
    };
    purgeRetained(mb + D);
    retainHooks.purgeStage = undefined;
    check("T35 만료 key_id 둘을 함께 파기 → 후보 세트에 두 키 모두 없음, 둘 다 DONE", !crossed && runs().length === 0 && rval("t35a", "x", "t35a", "c") === null && rval("t35b", "x", "t35b", "c") === null);
    check("K6 확인: 실제·확정 세트·tmp 어디에도 파기한 키 파일 0", listSets().every((s) => setKeyIds(s.dir).every((k) => ![keyIdFor(ma), keyIdFor(mb), keyIdFor(ms)].includes(k))) && ![ma, mb, ms].some((m) => fs.existsSync(rtDir("retained-keys", `${keyIdFor(m)}.key`))));
    // 검수 2: 서로 다른 단계의 키 둘(하나는 OLD_SETS_GONE에서 멈춤, 하나는 새로 PLANNED)이 겹쳐도 둘 다 DONE
    {
      const mx = Date.UTC(2043, 0, 10, 12), my = Date.UTC(2043, 5, 10, 12);
      mkv("t2x", mx); mkv("t2y", my); mkv("t2keep", Date.UTC(2050, 0, 1));
      backupRetained(NOW); // 두 키를 모두 담은 옛 세트
      retainHooks.purgeStage = (s) => { if (s === "OLD_SETS_GONE") throw new Error("멈춤"); };
      try { purgeRetained(mx + D); } catch { /* 멈춤 */ }
      retainHooks.purgeStage = undefined;
      const x1 = runs().find((r) => r.key_id === keyIdFor(mx))?.stage;
      const deploy = backupRetained(NOW); // 멈춘 사이 배포 백업(y 키는 아직 파기 대상이 아니라 들어 있다)
      const yIn = Boolean(deploy) && setKeyIds(path.join(rtDir("retained-backups"), deploy!)).includes(keyIdFor(my));
      // 다음 실행 첫 번째: y의 새 후보 세트 만들기가 실패 → 옛 후보로 다른 세트를 지우지 않는다
      retainHooks.backupStep = (s) => { if (s === "copied") throw new Error("백업 실패 흉내"); };
      const fail1 = purgeRetained(my + D);
      retainHooks.backupStep = undefined;
      const afterFail = runs().map((r) => `${r.key_id}:${r.stage}`).sort().join(",");
      const r2 = purgeRetained(my + D);
      const r3 = runs().length ? purgeRetained(my + D) : r2;
      check("검수2 OLD_SETS_GONE 키와 PLANNED 키가 겹쳐도(후보 만들기 1회 실패 포함) 둘 다 DONE, 다른 키 유지",
        x1 === "OLD_SETS_GONE" && yIn && fail1.stuck.includes(keyIdFor(my)) && runs().length === 0 && rval("t2x", "x", "t2x", "c") === null && rval("t2y", "x", "t2y", "c") === null
          && rval("t2keep", "x", "t2keep", "c") === "t2keep" && listSets().every((s) => setKeyIds(s.dir).every((k) => k !== keyIdFor(mx) && k !== keyIdFor(my))),
        `${x1} yIn=${yIn} fail=${JSON.stringify(fail1)} mid=${afterFail} r2=${JSON.stringify(r2)} r3=${JSON.stringify(r3)}`);
      const one = (retainedDb().prepare("SELECT COUNT(DISTINCT candidate_set_id) n FROM purge_runs").get() as { n: number }).n;
      check("검수2 진행 줄이 남아 있다면 후보 세트는 하나뿐", one <= 1);
    }
  }

  // ── T34 전체 되돌리기 검사 ──
  {
    const cjs = path.join(APP, "..", "ops", "withdraw2_rollback.cjs");
    const S4 = user(), B4 = user(); makeTrade(S4, B4, `R${hex(4)}`); withdrawUser(B4); // withdrawals 1건(RETAIN_PENDING)
    const r1 = spawnSync(process.execPath, [cjs, dbPath, rtDir()], { encoding: "utf8" });
    check("T34 withdrawals·보관 기록이 있으면 전체 되돌리기 거절(종료 코드 2)", r1.status === 2, `${r1.status} ${r1.stderr}`);
    const scratch = path.join(ROOT, "rollback_scratch.db");
    fs.rmSync(scratch, { force: true });
    await new Database(dbPath, { readonly: true }).backup(scratch);
    const sc = new Database(scratch); sc.exec("DELETE FROM withdrawals"); sc.close();
    const emptyRt = path.join(ROOT, "empty_rt"); fs.rmSync(emptyRt, { recursive: true, force: true }); fs.mkdirSync(emptyRt, { recursive: true });
    const r2 = spawnSync(process.execPath, [cjs, scratch, emptyRt, "--apply"], { encoding: "utf8" });
    const sc2 = new Database(scratch, { readonly: true });
    const left = (sc2.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'withdrawals' OR (type = 'trigger' AND name LIKE 'wd_%')").get() as { n: number }).n;
    sc2.close();
    check("T34 모두 0인 사본에서는 실행 → 트리거·표 제거", r2.status === 0 && left === 0, `${r2.status} ${r2.stderr} left=${left}`);
    // 검수 4: 0019 기록만 지운다(최신 행이 아니라), 더 새 기록이 있으면 거절
    const journal = JSON.parse(fs.readFileSync(path.join(APP, "drizzle", "meta", "_journal.json"), "utf8")) as { entries: { tag: string; when: number }[] };
    const w19 = journal.entries.find((e) => e.tag === "0019_withdraw2")!.when, w18 = journal.entries.find((e) => e.tag === "0018_withdraw")!.when;
    const migs = (p: string) => { const c = new Database(p, { readonly: true }); const r = c.prepare("SELECT created_at FROM __drizzle_migrations ORDER BY created_at").all() as { created_at: number }[]; c.close(); return r.map((x) => Number(x.created_at)); };
    const after2 = migs(scratch);
    check("검수4 전체 되돌리기는 0019 기록 1줄만 지움(0018 이하 그대로)", !after2.includes(w19) && after2.includes(w18) && after2.length === migs(dbPath).length - 1, after2.slice(-3).join(","));
    const mkScratch = async (name: string) => {
      const p = path.join(ROOT, name);
      for (const s of ["", "-wal", "-shm"]) fs.rmSync(p + s, { force: true });
      await new Database(dbPath, { readonly: true }).backup(p);
      const s = new Database(p); s.exec("CREATE TABLE wd_hold AS SELECT * FROM withdrawals; DELETE FROM withdrawals;"); s.close();
      return p;
    };
    const tables = (p: string) => { const c = new Database(p, { readonly: true }); const n = (c.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'withdrawals'").get() as { n: number }).n; const w = n ? (c.prepare("SELECT COUNT(*) n FROM withdrawals").get() as { n: number }).n : -1; c.close(); return { n, w }; };
    const s20 = await mkScratch("rollback_0020.db");
    { const c = new Database(s20); c.prepare("INSERT INTO __drizzle_migrations(hash, created_at) VALUES('fake0020', ?)").run(w19 + 1000); c.close(); }
    const r20 = spawnSync(process.execPath, [cjs, s20, emptyRt, "--apply"], { encoding: "utf8" });
    check("검수4 가짜 0020 기록이 있으면 전체 되돌리기 거절(종료 2, 표·기록 그대로)", r20.status === 2 && tables(s20).n === 1 && migs(s20).includes(w19) && /newer_migrations=1/.test(r20.stderr), `${r20.status} ${r20.stderr}`);
    // 검수 5: 검사와 실행 사이 경쟁 — 잠금을 잡은 뒤 다시 검사하고 그 안에서 실행
    const runPaused = (p: string, pause: string, onPause: () => void) => new Promise<{ status: number | null; out: string; err: string }>((res) => {
      const ch = spawn(process.execPath, [cjs, p, emptyRt, "--apply"], { env: { ...process.env, WD2_RB_PAUSE: pause } });
      let out = "", err = "", fired = false;
      ch.stdout.on("data", (d) => { out += d; if (!fired && out.includes("PAUSE ")) { fired = true; onPause(); } });
      ch.stderr.on("data", (d) => (err += d));
      ch.on("close", (status) => res({ status, out, err }));
    });
    const sA = await mkScratch("rollback_raceA.db");
    let wroteA = false;
    const rA = await runPaused(sA, "after-check:1500", () => { const c = new Database(sA); c.exec("INSERT INTO withdrawals SELECT * FROM wd_hold"); wroteA = true; c.close(); });
    const tA = tables(sA);
    check("검수5 0건 검사 직후 다른 연결이 탈퇴를 씀 → 잠금 안 다시 검사에서 거절(종료 2), 새 줄 남음", wroteA && rA.status === 2 && tA.n === 1 && tA.w > 0 && /잠금 안 다시 검사/.test(rA.err), `${rA.status} ${rA.err} ${JSON.stringify(tA)}`);
    const sB = await mkScratch("rollback_raceB.db");
    let busyB = "";
    const rB = await runPaused(sB, "after-lock:2500", () => {
      const c = new Database(sB); c.pragma("busy_timeout = 300");
      try { c.exec("INSERT INTO withdrawals SELECT * FROM wd_hold"); busyB = "written"; } catch (e) { busyB = (e as { code?: string }).code ?? String(e); }
      c.close();
    });
    check("검수5 잠금을 잡은 동안 다른 연결의 탈퇴 쓰기는 실패(BUSY) → 롤백 뒤 지워진 새 줄 없음", rB.status === 0 && busyB.startsWith("SQLITE_BUSY") && tables(sB).n === 0, `${rB.status} ${busyB} ${rB.err}`);
  }

  // ── 검수 6: 하루 한 번 보관 백업 세트 ──
  useRt("daily");
  {
    const empty = dailyRetainedBackup(NOW);
    withRetainLock((l) => putValues(l, [{ userId: "d6", srcTable: "x", srcId: "1", col: "c", value: "v", expiresMs: Date.UTC(2045, 0, 1) }], NOW));
    const first = dailyRetainedBackup(NOW);
    const again = dailyRetainedBackup(NOW + 23 * H);
    const later = dailyRetainedBackup(NOW + 25 * H);
    const sets = listSets().filter((s) => !s.tmp).length;
    check("검수6 보관 자료 없으면 안 만듦, 있으면 만듦, 24시간 안 다시 안 만듦, 넘으면 만듦", empty === null && Boolean(first) && again === null && Boolean(later) && sets === 2, `${empty} ${first} ${again} ${later} sets=${sets}`);
    const jobsSrc = fs.readFileSync(path.join(APP, "src", "lib", "jobs.ts"), "utf8");
    check("검수6 runJobs에 보관 백업 단계(retainBackup → dailyRetainedBackup) 연결", /step\("retainBackup",[^\n]*dailyRetainedBackup\(\)/.test(jobsSrc));
    // 사용자 결정(2026-10-28): 최근 7개만 남긴다. 파기 작업이 쓰는 후보 세트는 7개 밖이어도 남는다
    const oldest = listSets().filter((s) => !s.tmp).map((s) => s.name).sort()[0];
    withRetainLock((l) => l.conn.prepare("INSERT INTO purge_runs (key_id, stage, candidate_set_id, updated_at) VALUES ('k7test', 'CANDIDATE_OK', ?, ?)").run(oldest, NOW));
    for (let i = 2; i <= 9; i++) dailyRetainedBackup(NOW + (25 * i) * H);
    const names = listSets().filter((s) => !s.tmp).map((s) => s.name);
    check("보관 세트 7개 유지: 10개 만들면 최근 7개 + 파기 후보 1개만 남음", names.length === 8 && names.includes(oldest), `n=${names.length} oldest=${names.includes(oldest)}`);
    withRetainLock((l) => l.conn.prepare("DELETE FROM purge_runs WHERE key_id = 'k7test'").run());
    dailyRetainedBackup(NOW + 300 * H);
    const after = listSets().filter((s) => !s.tmp).map((s) => s.name);
    check("보관 세트 7개 유지: 후보 표시가 풀리면 다음 날 7개로 줄어듦", after.length === 7 && !after.includes(oldest), `n=${after.length}`);
  }

  // ── 검수 3: 사진 컴포넌트는 /_next/image를 만들지 않는다 ──
  {
    const React = appRequire("react") as typeof import("react");
    const { renderToStaticMarkup } = appRequire("react-dom/server") as typeof import("react-dom/server");
    const NextImage = (appRequire("next/image") as { default: typeof import("next/image").default }).default;
    const src = "/api/photos/aaaaaaaaaaaaaaaaaaaaaaaa.webp?v=2";
    const safe = renderToStaticMarkup(React.createElement(SafePhoto, { src, alt: "a", sizes: "72px", fallback: null }));
    const gal = renderToStaticMarkup(React.createElement(PhotoGallery, { photos: [{ fileName: "aaaaaaaaaaaaaaaaaaaaaaaa.webp", width: 10, height: 10 }], title: "t" }));
    const plain = renderToStaticMarkup(React.createElement(NextImage, { src, alt: "a", width: 10, height: 10 }));
    check("검수3 SafePhoto·PhotoGallery는 원본 API를 바로 씀(/_next/image 0건)", !safe.includes("/_next/image") && !gal.includes("/_next/image") && safe.includes(`src="${src.replace("&", "&amp;")}"`) && gal.includes("/api/photos/"), `${safe} | ${gal}`);
    check("검수3 대조: unoptimized 없는 next/image는 /_next/image를 만든다(검사가 실제로 잡는지)", plain.includes("/_next/image"), plain);
  }

  closeRetained();
  process.chdir(APP);
  console.log(`== 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
