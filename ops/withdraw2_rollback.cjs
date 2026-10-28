/* eslint-disable @typescript-eslint/no-require-imports -- Node 운영 스크립트(CommonJS) */
// 탈퇴 2단계 전체 되돌리기 묶음(docs/review/WITHDRAW_PLAN_v12.md 0000절 2). 검사와 실행을 묶어, 남은 기록이 모두 0일 때만 0019_down_full.sql을 실행한다.
// 긴급 되돌리기는 이 스크립트가 아니라 app/drizzle/rollback/0019_down_triggers.sql(트리거만)이다.
// 사용(app 폴더): node ../ops/withdraw2_rollback.cjs <DB 경로> <runtime-data 폴더> [--apply]
//   --apply 없으면 검사만 한다. 하나라도 0이 아니면 종료 코드 2로 멈춘다.
//   --apply: 운영 DB BEGIN EXCLUSIVE + 보관 DB BEGIN EXCLUSIVE를 잡은 뒤 같은 연결로 전 항목을 다시 검사하고, 그 안에서 DDL을 실행한다.
//   0019보다 새 마이그레이션 기록이 있거나 0019 기록이 정확히 1줄이 아니면 거절한다.
const fs = require("node:fs");
const path = require("node:path");
const Database = require(require.resolve("better-sqlite3", { paths: [path.join(__dirname, "..", "app")] }));

const [dbPath, rt] = process.argv.slice(2);
const apply = process.argv.includes("--apply");
if (!dbPath || !rt) { console.error("사용: node ops/withdraw2_rollback.cjs <DB 경로> <runtime-data 폴더> [--apply]"); process.exit(1); }

// 0019의 마이그레이션 기록 시각(= _journal.json의 when, drizzle이 __drizzle_migrations.created_at에 적는 값)
const journal = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "drizzle", "meta", "_journal.json"), "utf8"));
const MIG0019 = journal.entries.find((e) => e.tag === "0019_withdraw2")?.when;
const sqlText = fs.readFileSync(path.join(__dirname, "..", "app", "drizzle", "rollback", "0019_down_full.sql"), "utf8");
if (typeof MIG0019 !== "number" || !sqlText.includes(`created_at = ${MIG0019};`)) { console.error("0019 기록 시각이 journal과 0019_down_full.sql에서 다름"); process.exit(1); }

// 시험 전용: WD2_RB_PAUSE="after-check:<ms>" 또는 "after-lock:<ms>"면 그 지점에서 PAUSE 줄을 찍고 멈춘다(경쟁 시험). 운영에서는 비어 있다
const [pauseAt, pauseMs] = (process.env.WD2_RB_PAUSE ?? "").split(":");
// param: at 지점 이름. return: 없음
function pause(at) {
  if (pauseAt !== at) return;
  console.log(`PAUSE ${at}`);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(pauseMs) || 0);
}

// param: db 운영 DB 연결, r 보관 DB 연결(없으면 null). return: 검사 항목별 개수(모두 0이어야 전체 되돌리기 가능)
function counts(db, r) {
  const out = {};
  const has = (c, n) => Boolean(c.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(n));
  out.withdrawals = has(db, "withdrawals") ? db.prepare("SELECT COUNT(*) n FROM withdrawals").get().n : 0;
  const mig = has(db, "__drizzle_migrations");
  out.newer_migrations = mig ? db.prepare("SELECT COUNT(*) n FROM __drizzle_migrations WHERE created_at > ?").get(MIG0019).n : 0;
  out.mig0019_not_one = mig ? Number(db.prepare("SELECT COUNT(*) n FROM __drizzle_migrations WHERE created_at = ?").get(MIG0019).n !== 1) : 1;
  if (r) for (const t of ["retained_values", "retained_files", "purge_runs", "key_registry"]) out[t] = has(r, t) ? r.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n : 0;
  const files = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isFile()).length : 0);
  out.key_files = files(path.join(rt, "retained-keys"));
  out.retained_photos = files(path.join(rt, "retained")) + files(path.join(rt, "retained", "staging"));
  out.backup_sets = fs.existsSync(path.join(rt, "retained-backups")) ? fs.readdirSync(path.join(rt, "retained-backups")).length : 0;
  return out;
}

// param: c 검사 결과, where 단계 이름, onStop 멈추기 전에 할 일(잠금 풀기). return: 없음. 하나라도 0이 아니면 종료 코드 2
function stopIfBlocked(c, where, onStop) {
  console.log(where, JSON.stringify(c));
  const blocked = Object.entries(c).filter(([, n]) => n > 0);
  if (blocked.length === 0) return;
  onStop?.();
  console.error(`전체 되돌리기 불가(${where}): ${blocked.map(([k, n]) => `${k}=${n}`).join(", ")}`);
  process.exit(2);
}

const rdb = path.join(rt, "retained.db");
{
  const db = new Database(dbPath, { readonly: true });
  const r = fs.existsSync(rdb) ? new Database(rdb, { readonly: true }) : null;
  const c = counts(db, r);
  db.close(); r?.close();
  stopIfBlocked(c, "검사");
}
if (!apply) { console.log("검사 통과(실행하려면 --apply)"); process.exit(0); }
pause("after-check");

// 잠금을 잡고 다시 검사 → 그 안에서 실행. 보관 DB 파일이 없으면 만들지 않는다(보관 줄은 withdrawals가 있어야 생기고, 운영 DB는 이미 잠겨 있다)
const db = new Database(dbPath);
db.pragma("busy_timeout = 10000");
const r = fs.existsSync(rdb) ? new Database(rdb) : null;
r?.pragma("busy_timeout = 10000");
db.exec("BEGIN EXCLUSIVE");
try {
  r?.exec("BEGIN EXCLUSIVE");
} catch (e) { db.exec("ROLLBACK"); throw e; }
const unlock = () => { try { r?.exec("ROLLBACK"); } catch { /* 이미 풀림 */ } try { db.exec("ROLLBACK"); } catch { /* 이미 풀림 */ } };
stopIfBlocked(counts(db, r), "잠금 안 다시 검사", unlock);
pause("after-lock");
try {
  db.exec(sqlText);
  db.exec("COMMIT");
} catch (e) { unlock(); throw e; }
try { r?.exec("ROLLBACK"); } catch { /* 보관 DB는 읽기만 했다 */ }
db.close(); r?.close();
console.log("0019 전체 되돌리기 완료");
