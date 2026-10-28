// 탈퇴 2단계 보관 DB(docs/review/WITHDRAW_PLAN_v12.md 00000절 S1~S4, 4절).
// runtime-data/retained.db(journal_mode=DELETE, secure_delete=ON)에 탈퇴자 거래 기록 속 개인정보를 만료일별 키로 암호화해 둔다.
// 읽는 곳은 파기·백업 검증·시험뿐이다(화면·관리자 CSV·API에서 읽지 않음). 모든 쓰기는 locks 표 잠금(fence) 안에서만 한다.
import Database from "better-sqlite3";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const LOCK_MS = 10 * 60_000; // 잠금 기한(이어받기 10분)
const LOCK_EXTEND_BELOW_MS = 5 * 60_000; // 남은 기한이 5분보다 적으면 늘린다
const FILE_OP_MIN_LEFT_MS = 2 * 60_000; // 파일 작업은 남은 기한 2분 이상일 때만
export const ORPHAN_MS = 24 * 3600_000; // 고아 파일 정리 기준 24시간
const KEY_RE = /^(\d{8})\.key$/;

// 시험 전용 끼워 넣기(단계 뒤 멈춤 흉내). 운영에서는 비어 있다.
export const retainHooks: {
  keyStep?: (n: number) => void; // S3 키 만들기 1~5단계 뒤
  fileStep?: (n: number) => void; // S4 보관 사진 1~4단계 뒤
  backupStep?: (s: "start" | "copied" | "verified") => void; // 보관 백업 세트 만들기 중
  deleteSet?: (name: string) => boolean; // false면 세트 삭제 실패 흉내
  purgeStage?: (stage: string) => void; // 파기 단계 뒤
} = {};

export class FenceLost extends Error { constructor() { super("RETAIN_FENCE_LOST"); } }

// param: p 하위 경로. return: process.cwd() 기준 runtime-data 아래 절대경로
export function rtDir(...p: string[]): string { return path.join(process.cwd(), "runtime-data", ...p); }
const dbFile = () => rtDir("retained.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS retained_values (withdrawn_user_id TEXT NOT NULL, src_table TEXT NOT NULL, src_id TEXT NOT NULL, col TEXT NOT NULL,
  key_id TEXT NOT NULL, box TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (withdrawn_user_id, src_table, src_id, col));
CREATE TABLE IF NOT EXISTS retained_files (withdrawn_user_id TEXT NOT NULL, kind TEXT NOT NULL, file_name TEXT NOT NULL, src_id TEXT,
  key_id TEXT NOT NULL, state TEXT NOT NULL, missing INTEGER NOT NULL DEFAULT 0, src_removed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
  PRIMARY KEY (withdrawn_user_id, kind, file_name));
CREATE TABLE IF NOT EXISTS purge_runs (key_id TEXT PRIMARY KEY, stage TEXT NOT NULL, candidate_set_id TEXT, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS locks (name TEXT PRIMARY KEY, owner TEXT, fence INTEGER NOT NULL DEFAULT 0, until INTEGER);
CREATE TABLE IF NOT EXISTS key_registry (key_id TEXT PRIMARY KEY, sha256 TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS retained_values_key ON retained_values(key_id);
CREATE INDEX IF NOT EXISTS retained_files_key ON retained_files(key_id);`;

const conns = new Map<string, Database.Database>();

// param: file DB 파일(기본 runtime-data/retained.db). return: 열린 연결(같은 파일은 한 번만 연다)
export function retainedDb(file = dbFile()): Database.Database {
  let c = conns.get(file);
  if (c && c.open) return c;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  c = new Database(file);
  c.pragma("journal_mode = DELETE");
  c.pragma("secure_delete = ON");
  c.pragma("busy_timeout = 5000");
  c.exec(SCHEMA);
  conns.set(file, c);
  return c;
}

// 시험용: 열린 보관 DB 연결을 모두 닫는다
export function closeRetained(): void { for (const c of conns.values()) if (c.open) c.close(); conns.clear(); }

// ── 시각·키 id ──
// param: ms 만료 시각. return: key_id(만료일 UTC YYYYMMDD)
export function keyIdFor(ms: number): string { return new Date(ms).toISOString().slice(0, 10).replace(/-/g, ""); }
// param: keyId, nowMs. return: 그 만료일이 다 지났는지(다음 날 0시 UTC 이후면 참 — 기한 전에는 절대 지우지 않는다)
export function keyIdPurgeable(keyId: string, nowMs: number): boolean {
  const y = +keyId.slice(0, 4), m = +keyId.slice(4, 6) - 1, d = +keyId.slice(6, 8);
  return nowMs >= Date.UTC(y, m, d + 1);
}

// ── 잠금(S2) ──
export type RetainLock = { owner: string; fence: number; conn: Database.Database };

// 잠금 기한은 작업 시작 시각(nowMs)이 아니라 매번 이 시계로 잰다. 운영은 실제 시각, 시험만 바꾼다
export const retainClock: { now: () => number } = { now: () => Date.now() };

// param: conn. return: 잠금(얻지 못하면 null). 기한은 retainClock 기준
export function acquireRetainLock(conn = retainedDb()): RetainLock | null {
  conn.prepare("INSERT OR IGNORE INTO locks(name, fence) VALUES('retained', 0)").run();
  const owner = randomBytes(12).toString("hex");
  const t = retainClock.now();
  const r = conn.prepare("UPDATE locks SET owner = ?, fence = fence + 1, until = ? WHERE name = 'retained' AND (owner IS NULL OR until < ?) RETURNING fence")
    .get(owner, t + LOCK_MS, t) as { fence: number } | undefined;
  return r ? { owner, fence: r.fence, conn } : null;
}

// param: lock. return: 없음(내 fence일 때만 푼다)
export function releaseRetainLock(lock: RetainLock): void {
  lock.conn.prepare("UPDATE locks SET owner = NULL, until = NULL WHERE name = 'retained' AND fence = ? AND owner = ?").run(lock.fence, lock.owner);
}

// param: lock. return: 없음. 예외: fence가 다르면 FenceLost
export function assertFence(lock: RetainLock): void {
  const r = lock.conn.prepare("SELECT fence, owner FROM locks WHERE name = 'retained'").get() as { fence: number; owner: string | null } | undefined;
  if (!r || r.fence !== lock.fence || r.owner !== lock.owner) throw new FenceLost();
}

// param: lock, fn 보관 DB 쓰기. return: fn 결과. BEGIN IMMEDIATE 첫 문장에서 fence를 확인한다
export function retainTx<T>(lock: RetainLock, fn: () => T): T {
  return lock.conn.transaction(() => { assertFence(lock); return fn(); }).immediate();
}

// param: lock. return: 없음. 파일 작업 직전(매번 retainClock으로 잰다): fence 확인, 기한이 이미 지났으면 예외(다른 작업자가 이어받을 수 있음),
// 기한이 5분 미만이면 늘리고, 남은 기한 2분 미만이면 예외
export function beforeFileOp(lock: RetainLock): void {
  const t = retainClock.now();
  const r = lock.conn.prepare("SELECT fence, owner, until FROM locks WHERE name = 'retained'").get() as { fence: number; owner: string | null; until: number | null } | undefined;
  if (!r || r.fence !== lock.fence || r.owner !== lock.owner) throw new FenceLost();
  let until = r.until ?? 0;
  if (until <= t) throw new FenceLost();
  if (until - t < LOCK_EXTEND_BELOW_MS) {
    const u = lock.conn.prepare("UPDATE locks SET until = ? WHERE name = 'retained' AND fence = ? AND owner = ? AND until > ?").run(t + LOCK_MS, lock.fence, lock.owner, t);
    if (u.changes !== 1) throw new FenceLost();
    until = t + LOCK_MS;
  }
  if (until - t < FILE_OP_MIN_LEFT_MS) throw new FenceLost();
}

// param: fn 잠금 안에서 할 일. return: fn 결과, 잠금을 얻지 못하면 null
export function withRetainLock<T>(fn: (lock: RetainLock) => T): T | null {
  const lock = acquireRetainLock();
  if (!lock) return null;
  try { return fn(lock); } finally { releaseRetainLock(lock); }
}

// ── 키(S3) ──
const secret = (): string => {
  const s = process.env.RETAIN_SECRET;
  if (!s || s.length < 32) throw new Error("RETAIN_SECRET이 없거나 32자보다 짧아요.");
  return s;
};
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const derive = (salt: Buffer) => Buffer.from(hkdfSync("sha256", secret(), salt, "sseoboni-retain-v1", 32));
const keyDir = (base = rtDir()) => path.join(base, "retained-keys");
let dirSyncNoted = false;

// param: dir 폴더. return: 없음. Windows는 폴더 fsync가 없어 건너뛰고 로그에 한 번 적는다
export function fsyncDir(dir: string): void {
  if (process.platform === "win32") {
    if (!dirSyncNoted) { dirSyncNoted = true; console.log("[retain] Windows: 폴더 fsync 건너뜀"); }
    return;
  }
  const fd = fs.openSync(dir, "r");
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function writeSynced(file: string, data: Buffer): void {
  const fd = fs.openSync(file, "w");
  try { fs.writeSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

// param: lock, keyId. return: 디스크에 확실히 쓴 소금(32바이트). 예외: 등록 해시와 다르면 사용 중지
export function ensureKey(lock: RetainLock, keyId: string): Buffer {
  const dir = keyDir();
  fs.mkdirSync(dir, { recursive: true });
  const final = path.join(dir, `${keyId}.key`);
  const reg = () => lock.conn.prepare("SELECT sha256 FROM key_registry WHERE key_id = ?").get(keyId) as { sha256: string } | undefined;
  const checked = (): Buffer => {
    const b = fs.readFileSync(final);
    const r = reg();
    if (b.length !== 32 || !r || r.sha256 !== sha(b)) throw new Error(`[retain] 키 ${keyId} 손상(등록 해시와 다름) — 사용 중지`);
    return b;
  };
  if (fs.existsSync(final)) return checked();
  for (let attempt = 0; attempt < 2; attempt++) {
    const tmp = path.join(dir, `tmp-${randomBytes(8).toString("hex")}`);
    const salt = randomBytes(32);
    writeSynced(tmp, salt); // 1·2: tmp 쓰기 + fsync
    retainHooks.keyStep?.(1); retainHooks.keyStep?.(2);
    try {
      retainTx(lock, () => lock.conn.prepare("INSERT OR IGNORE INTO key_registry(key_id, sha256, created_at) VALUES(?, ?, ?)").run(keyId, sha(salt), Date.now()));
      retainHooks.keyStep?.(3);
      const r = reg();
      if (r && r.sha256 !== sha(salt)) {
        // 다른 실행이 먼저 등록했다: 내 tmp는 버리고 그 파일을 쓴다
        fs.rmSync(tmp, { force: true });
        if (fs.existsSync(final)) return checked();
        const used = (lock.conn.prepare("SELECT (SELECT COUNT(*) FROM retained_values WHERE key_id = ?) + (SELECT COUNT(*) FROM retained_files WHERE key_id = ?) n").get(keyId, keyId) as { n: number }).n;
        if (used > 0) throw new Error(`[retain] 키 ${keyId} 파일이 없는데 암호문이 있음 — 사용 중지`);
        // 등록만 되고 파일 연결 전에 멈춘 흔적(암호문 없음): 지우고 다시 만든다
        retainTx(lock, () => lock.conn.prepare("DELETE FROM key_registry WHERE key_id = ?").run(keyId));
        continue;
      }
      try { fs.linkSync(tmp, final); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
      fs.rmSync(tmp, { force: true });
      retainHooks.keyStep?.(4);
      fsyncDir(dir);
      retainHooks.keyStep?.(5);
      return checked();
    } finally { fs.rmSync(tmp, { force: true }); }
  }
  throw new Error(`[retain] 키 ${keyId}를 만들지 못했어요`);
}

// param: keyId, keys 소금 파일 폴더(기본 runtime-data/retained-keys). return: 암호화 키, 소금 파일이 없으면 null
function keyFor(keyId: string, keys = keyDir()): Buffer | null {
  try { const salt = fs.readFileSync(path.join(keys, `${keyId}.key`)); return salt.length === 32 ? derive(salt) : null; } catch { return null; }
}

function encrypt(key: Buffer, data: Buffer): { iv: Buffer; tag: Buffer; ct: Buffer } {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(data), c.final()]);
  return { iv, tag: c.getAuthTag(), ct };
}
function decrypt(key: Buffer, iv: Buffer, tag: Buffer, ct: Buffer): Buffer | null {
  try { const d = createDecipheriv("aes-256-gcm", key, iv); d.setAuthTag(tag); return Buffer.concat([d.update(ct), d.final()]); } catch { return null; }
}

// param: salt 소금, keyId, value 평문. return: r1.<YYYYMMDD>.<iv>.<tag>.<ct>
function sealWith(salt: Buffer, keyId: string, value: string): string {
  const { iv, tag, ct } = encrypt(derive(salt), Buffer.from(value, "utf8"));
  return ["r1", keyId, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

// param: box 보관 암호문, keys 소금 폴더. return: 평문, 키가 없거나 손상이면 null
export function retainOpen(box: string, keys?: string): string | null {
  const [v, keyId, iv, tag, ct] = box.split(".");
  if (v !== "r1" || !keyId || !iv || !tag || !ct) return null;
  const key = keyFor(keyId, keys);
  if (!key) return null;
  return decrypt(key, Buffer.from(iv, "base64url"), Buffer.from(tag, "base64url"), Buffer.from(ct, "base64url"))?.toString("utf8") ?? null;
}

// param: data 암호화된 파일 바이트, keys 소금 폴더. return: 원래 바이트, 실패하면 null
export function retainOpenFile(data: Buffer, keys?: string): Buffer | null {
  const head = data.subarray(0, 12).toString("latin1");
  const m = /^r1\.(\d{8})\.$/.exec(head);
  if (!m) return null;
  const key = keyFor(m[1], keys);
  if (!key) return null;
  return decrypt(key, data.subarray(12, 24), data.subarray(24, 40), data.subarray(40));
}

// ── 값·파일 넣기 ──
export type RetainValueIn = { userId: string; srcTable: string; srcId: string; col: string; value: string; expiresMs: number };
export type RetainFileIn = { userId: string; kind: "listing" | "order"; srcId: string; fileName: string; expiresMs: number; srcPaths: string[] };

const purging = (lock: RetainLock, keyId: string) => Boolean(lock.conn.prepare("SELECT 1 FROM purge_runs WHERE key_id = ?").get(keyId));
// param: lock, keyId, nowMs. return: 이 키로 새로 보관해도 되는지(이미 만료됐거나 파기 중이면 거짓 — 보관하지 않고 바로 비운다)
export function keyUsable(lock: RetainLock, keyId: string, nowMs: number): boolean { return !keyIdPurgeable(keyId, nowMs) && !purging(lock, keyId); }

// param: lock, rows, nowMs. return: 새로 넣은 줄 수. 빈 값·만료된 값은 넣지 않고, 이미 있는 보관값은 바꾸지 않는다(INSERT OR IGNORE)
export function putValues(lock: RetainLock, rows: RetainValueIn[], nowMs: number): number {
  const ready = rows.filter((r) => r.value !== "").map((r) => ({ ...r, keyId: keyIdFor(r.expiresMs) })).filter((r) => keyUsable(lock, r.keyId, nowMs));
  const salts = new Map<string, Buffer>();
  for (const r of ready) if (!salts.has(r.keyId)) salts.set(r.keyId, ensureKey(lock, r.keyId));
  return retainTx(lock, () => {
    const ins = lock.conn.prepare("INSERT OR IGNORE INTO retained_values(withdrawn_user_id, src_table, src_id, col, key_id, box, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)");
    let n = 0;
    for (const r of ready) n += ins.run(r.userId, r.srcTable, r.srcId, r.col, r.keyId, sealWith(salts.get(r.keyId)!, r.keyId, r.value), nowMs).changes;
    return n;
  });
}

const storeName = (kind: string, fileName: string) => `${kind}-${fileName}.r1`;
const retainedPath = (name: string) => rtDir("retained", name);
const retainedStaging = (name: string) => rtDir("retained", "staging", name);

// param: lock, f 보관할 사진, nowMs. return: OK(보관됨)·MISSING(원본 없음 기록)·SKIPPED(만료라 보관 안 함). S4 순서: staging 쓰기 → PENDING_FILE 줄 → rename → OK
export function putFile(lock: RetainLock, f: RetainFileIn, nowMs: number): "OK" | "MISSING" | "SKIPPED" {
  const keyId = keyIdFor(f.expiresMs);
  const row = lock.conn.prepare("SELECT state FROM retained_files WHERE withdrawn_user_id = ? AND kind = ? AND file_name = ?").get(f.userId, f.kind, f.fileName) as { state: string } | undefined;
  if (row?.state === "OK") return "OK";
  if (!row && !keyUsable(lock, keyId, nowMs)) return "SKIPPED";
  const name = storeName(f.kind, f.fileName);
  // 이미 retained/에 있으면(rename 직후 멈춤) 마무리만 한다
  if (row && fs.existsSync(retainedPath(name))) {
    retainTx(lock, () => lock.conn.prepare("UPDATE retained_files SET state = 'OK' WHERE withdrawn_user_id = ? AND kind = ? AND file_name = ?").run(f.userId, f.kind, f.fileName));
    return "OK";
  }
  const src = f.srcPaths.find((p) => fs.existsSync(p));
  if (!src) {
    retainTx(lock, () => lock.conn.prepare("INSERT OR REPLACE INTO retained_files(withdrawn_user_id, kind, file_name, src_id, key_id, state, missing, src_removed, created_at) VALUES(?, ?, ?, ?, ?, 'OK', 1, 1, ?)")
      .run(f.userId, f.kind, f.fileName, f.srcId, keyId, nowMs));
    return "MISSING";
  }
  beforeFileOp(lock);
  const salt = ensureKey(lock, keyId);
  const { iv, tag, ct } = encrypt(derive(salt), fs.readFileSync(src));
  fs.mkdirSync(rtDir("retained", "staging"), { recursive: true });
  writeSynced(retainedStaging(name), Buffer.concat([Buffer.from(`r1.${keyId}.`, "latin1"), iv, tag, ct]));
  retainHooks.fileStep?.(1);
  retainTx(lock, () => lock.conn.prepare("INSERT OR IGNORE INTO retained_files(withdrawn_user_id, kind, file_name, src_id, key_id, state, created_at) VALUES(?, ?, ?, ?, ?, 'PENDING_FILE', ?)")
    .run(f.userId, f.kind, f.fileName, f.srcId, keyId, nowMs));
  retainHooks.fileStep?.(2);
  beforeFileOp(lock);
  fs.renameSync(retainedStaging(name), retainedPath(name));
  fsyncDir(rtDir("retained"));
  retainHooks.fileStep?.(3);
  retainTx(lock, () => lock.conn.prepare("UPDATE retained_files SET state = 'OK' WHERE withdrawn_user_id = ? AND kind = ? AND file_name = ?").run(f.userId, f.kind, f.fileName));
  retainHooks.fileStep?.(4);
  return "OK";
}

// param: userId. return: 아직 확정되지 않은(PENDING_FILE) 보관 사진 수
export function pendingFileCount(userId: string, conn = retainedDb()): number {
  return (conn.prepare("SELECT COUNT(*) n FROM retained_files WHERE withdrawn_user_id = ? AND state <> 'OK'").get(userId) as { n: number }).n;
}

// param: userId. return: 원본을 아직 못 지운 보관 사진 목록
export function srcPendingFiles(userId: string, conn = retainedDb()): { kind: "listing" | "order"; fileName: string }[] {
  return conn.prepare("SELECT kind, file_name fileName FROM retained_files WHERE withdrawn_user_id = ? AND src_removed = 0").all(userId) as { kind: "listing" | "order"; fileName: string }[];
}

// param: lock, userId, kind, fileName. return: 없음(원본 삭제 확인 표시)
export function markSrcRemoved(lock: RetainLock, userId: string, kind: string, fileName: string): void {
  retainTx(lock, () => lock.conn.prepare("UPDATE retained_files SET src_removed = 1 WHERE withdrawn_user_id = ? AND kind = ? AND file_name = ?").run(userId, kind, fileName));
}

// param: userId. return: 그 사용자의 보관 줄(값+사진) 수
export function retainedCount(userId: string, conn = retainedDb()): number {
  return (conn.prepare("SELECT (SELECT COUNT(*) FROM retained_values WHERE withdrawn_user_id = ?) + (SELECT COUNT(*) FROM retained_files WHERE withdrawn_user_id = ?) n").get(userId, userId) as { n: number }).n;
}

// ── 보관 백업 세트(S1) ──
const backupsDir = () => rtDir("retained-backups");
type Manifest = { createdAt: number; excluded: string[]; files: Record<string, string> };

function walk(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join("/")]);
}

// return: 보관 백업 폴더 목록(확정 세트와 tmp)
export function listSets(): { name: string; dir: string; tmp: boolean }[] {
  if (!fs.existsSync(backupsDir())) return [];
  return fs.readdirSync(backupsDir(), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => ({ name: e.name, dir: path.join(backupsDir(), e.name), tmp: e.name.startsWith("tmp-") }));
}

// param: dir 세트 폴더. return: 그 세트에 실제로 있는 키 파일의 key_id
export function setKeyIds(dir: string): string[] {
  const k = path.join(dir, "keys");
  return fs.existsSync(k) ? fs.readdirSync(k).map((f) => KEY_RE.exec(f)?.[1]).filter((x): x is string => Boolean(x)) : [];
}

// param: dir 세트 폴더, exclude 들어 있으면 안 되는 key_id. return: 없음. 예외: 검증 실패(목록 sha256·무결성·참조 파일·제외 키·표본 복호화)
export function verifySet(dir: string, exclude: Set<string> = new Set()): void {
  const man = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) as Manifest;
  const actual = walk(dir).filter((f) => f !== "manifest.json").sort();
  const listed = Object.keys(man.files).sort();
  if (actual.join("\n") !== listed.join("\n")) throw new Error("백업 목록과 실제 파일이 다름");
  for (const f of listed) if (sha(fs.readFileSync(path.join(dir, f))) !== man.files[f]) throw new Error(`백업 sha256 다름: ${f}`);
  for (const k of setKeyIds(dir)) if (exclude.has(k)) throw new Error(`제외할 키가 백업에 있음: ${k}`);
  const keys = path.join(dir, "keys");
  const c = new Database(path.join(dir, "retained.db"), { readonly: true });
  try {
    if (c.pragma("integrity_check", { simple: true }) !== "ok") throw new Error("백업 DB 무결성 실패");
    const keyIds = (c.prepare("SELECT key_id FROM retained_values UNION SELECT key_id FROM retained_files UNION SELECT key_id FROM key_registry").all() as { key_id: string }[]).map((r) => r.key_id);
    for (const k of keyIds) {
      if (exclude.has(k)) throw new Error(`제외할 키의 줄이 백업에 있음: ${k}`);
      const kf = path.join(keys, `${k}.key`);
      const reg = c.prepare("SELECT sha256 FROM key_registry WHERE key_id = ?").get(k) as { sha256: string } | undefined;
      if (!fs.existsSync(kf) || !reg || reg.sha256 !== sha(fs.readFileSync(kf))) throw new Error(`백업에 키 없음·다름: ${k}`);
      const v = c.prepare("SELECT box FROM retained_values WHERE key_id = ? LIMIT 1").get(k) as { box: string } | undefined;
      if (v && retainOpen(v.box, keys) === null) throw new Error(`백업 표본 복호화 실패: ${k}`);
    }
    for (const r of c.prepare("SELECT kind, file_name FROM retained_files WHERE missing = 0").all() as { kind: string; file_name: string }[]) {
      const p = path.join(dir, "files", storeName(r.kind, r.file_name));
      if (!fs.existsSync(p)) throw new Error(`백업에 보관 사진 없음: ${r.file_name}`);
      if (retainOpenFile(fs.readFileSync(p), keys) === null) throw new Error(`백업 사진 복호화 실패: ${r.file_name}`);
    }
  } finally { c.close(); }
}

// param: lock, nowMs, exclude 뺄 key_id(purge_runs 키는 늘 뺀다). return: 확정된 세트 이름. 실패하면 tmp를 지우고 예외(옛 세트는 그대로)
export function createBackupSet(lock: RetainLock, nowMs: number, exclude: Set<string> = new Set()): string {
  const ex = new Set([...exclude, ...(lock.conn.prepare("SELECT key_id FROM purge_runs").all() as { key_id: string }[]).map((r) => r.key_id)]);
  const id = `${nowMs}-${randomBytes(4).toString("hex")}`;
  const tmp = path.join(backupsDir(), `tmp-${id}`);
  beforeFileOp(lock);
  fs.mkdirSync(path.join(tmp, "files"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "keys"), { recursive: true });
  try {
    retainHooks.backupStep?.("start");
    const copy = path.join(tmp, "retained.db");
    lock.conn.exec(`VACUUM INTO '${copy.replace(/'/g, "''")}'`);
    const c = new Database(copy);
    try {
      c.pragma("journal_mode = DELETE");
      c.pragma("secure_delete = ON");
      const list = [...ex];
      c.exec("DELETE FROM purge_runs; DELETE FROM locks; DELETE FROM retained_files WHERE state <> 'OK';");
      if (list.length) for (const t of ["retained_values", "retained_files", "key_registry"]) c.prepare(`DELETE FROM ${t} WHERE key_id IN (${list.map(() => "?").join(",")})`).run(...list);
      c.exec("DELETE FROM key_registry WHERE key_id NOT IN (SELECT key_id FROM retained_values UNION SELECT key_id FROM retained_files)");
      c.exec("VACUUM");
      for (const r of c.prepare("SELECT kind, file_name FROM retained_files WHERE missing = 0").all() as { kind: string; file_name: string }[]) {
        const n = storeName(r.kind, r.file_name);
        fs.copyFileSync(retainedPath(n), path.join(tmp, "files", n));
      }
      for (const r of c.prepare("SELECT key_id FROM key_registry").all() as { key_id: string }[]) fs.copyFileSync(path.join(keyDir(), `${r.key_id}.key`), path.join(tmp, "keys", `${r.key_id}.key`));
    } finally { c.close(); }
    retainHooks.backupStep?.("copied");
    const files: Record<string, string> = {};
    for (const f of walk(tmp)) files[f] = sha(fs.readFileSync(path.join(tmp, f)));
    writeSynced(path.join(tmp, "manifest.json"), Buffer.from(JSON.stringify({ createdAt: nowMs, excluded: [...ex], files } satisfies Manifest)));
    verifySet(tmp, ex);
    retainHooks.backupStep?.("verified");
    beforeFileOp(lock);
    const name = `set-${id}`;
    fs.renameSync(tmp, path.join(backupsDir(), name));
    fsyncDir(backupsDir());
    return name;
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
}

// param: nowMs. return: 배포 때 쓸 보관 백업 세트 이름(잠금을 못 얻으면 null). 파기 중 key_id는 빠진다
export function backupRetained(nowMs = Date.now()): string | null {
  return withRetainLock((lock) => createBackupSet(lock, nowMs));
}

export const DAILY_BACKUP_MS = 24 * 3600_000;
// return: 가장 최근 확정 세트의 만든 시각(목록 파일 createdAt), 세트가 없으면 null
function latestSetMs(): number | null {
  let last: number | null = null;
  for (const s of listSets()) {
    if (s.tmp) continue;
    try {
      const t = (JSON.parse(fs.readFileSync(path.join(s.dir, "manifest.json"), "utf8")) as Manifest).createdAt;
      if (typeof t === "number" && (last === null || t > last)) last = t;
    } catch { /* 목록이 깨진 세트는 없는 것으로 본다 */ }
  }
  return last;
}

// param: nowMs. return: 새로 만든 세트 이름. 보관 자료가 없거나, 마지막 확정 세트가 24시간 안이거나, 잠금을 못 얻으면 null(정기 작업이 부른다)
// 보관 자료가 없으면 만들지 않는다(빈 세트가 전체 되돌리기 검사 backup_sets를 막지 않게)
export function dailyRetainedBackup(nowMs = Date.now()): string | null {
  return withRetainLock((lock) => {
    const n = (lock.conn.prepare("SELECT (SELECT COUNT(*) FROM retained_values) + (SELECT COUNT(*) FROM retained_files) + (SELECT COUNT(*) FROM key_registry) n").get() as { n: number }).n;
    if (n === 0) return null;
    const last = latestSetMs();
    if (last !== null && nowMs - last < DAILY_BACKUP_MS) return null;
    const name = createBackupSet(lock, nowMs);
    pruneOldSets(lock, name);
    return name;
  });
}

export const KEEP_SETS = 7; // 사용자 결정 2026-10-28 "권장안": 보관 백업 세트는 최근 7개만 남긴다
// param: lock, keep 방금 만든 세트 이름. return: 지운 세트 수. 파기 작업이 쓰는 후보 세트(purge_runs.candidate_set_id)는 지우지 않는다. 지우기 실패는 다음 날 다시 한다
export function pruneOldSets(lock: RetainLock, keep: string): number {
  const inUse = new Set((lock.conn.prepare("SELECT candidate_set_id c FROM purge_runs WHERE candidate_set_id IS NOT NULL").all() as { c: string }[]).map((r) => r.c));
  const sets = listSets().filter((s) => !s.tmp).sort((a, b) => b.name.localeCompare(a.name, "en", { numeric: true }));
  let n = 0;
  for (const s of sets.slice(KEEP_SETS)) {
    if (s.name === keep || inUse.has(s.name)) continue;
    beforeFileOp(lock);
    if (removeSet(s.dir)) n++;
  }
  return n;
}

// param: setDir 세트 폴더, target 복원할 runtime-data 폴더. return: 없음(시험·복구용: retained.db·retained/·retained-keys/로 복사)
export function restoreSet(setDir: string, target: string): void {
  verifySet(setDir);
  fs.mkdirSync(path.join(target, "retained"), { recursive: true });
  fs.mkdirSync(path.join(target, "retained-keys"), { recursive: true });
  fs.copyFileSync(path.join(setDir, "retained.db"), path.join(target, "retained.db"));
  for (const f of fs.readdirSync(path.join(setDir, "files"))) fs.copyFileSync(path.join(setDir, "files", f), path.join(target, "retained", f));
  for (const f of fs.readdirSync(path.join(setDir, "keys"))) fs.copyFileSync(path.join(setDir, "keys", f), path.join(target, "retained-keys", f));
}

function removeSet(dir: string): boolean {
  if (retainHooks.deleteSet && !retainHooks.deleteSet(path.basename(dir))) return false;
  try { fs.rmSync(dir, { recursive: true, force: true }); return !fs.existsSync(dir); } catch { return false; }
}

// param: file 지울 소금 파일. return: 없음. 0으로 덮어쓰고 fsync한 뒤 지운다
function shredKey(file: string): void {
  if (!fs.existsSync(file)) return;
  const fd = fs.openSync(file, "r+");
  try { fs.writeSync(fd, Buffer.alloc(fs.fstatSync(fd).size), 0, undefined, 0); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.unlinkSync(file);
  fsyncDir(path.dirname(file));
}

// ── 파기(S1 상태기계) ──
export type PurgeResult = { planned: number; done: number; stuck: string[] };

// param: nowMs. return: 파기 결과(잠금을 못 얻으면 stuck에 LOCKED). PLANNED → CANDIDATE_OK → OLD_SETS_GONE → LIVE_PURGED → DONE(줄 삭제)
export function purgeRetained(nowMs = Date.now()): PurgeResult {
  return withRetainLock((lock) => purgeWithLock(lock, nowMs)) ?? { planned: 0, done: 0, stuck: ["LOCKED"] };
}

function purgeWithLock(lock: RetainLock, nowMs: number): PurgeResult {
  const c = lock.conn;
  const out: PurgeResult = { planned: 0, done: 0, stuck: [] };
  const runs = () => c.prepare("SELECT key_id, stage, candidate_set_id, updated_at FROM purge_runs").all() as { key_id: string; stage: string; candidate_set_id: string | null; updated_at: number }[];
  const setStage = (keyId: string, stage: string) => retainTx(lock, () => c.prepare("UPDATE purge_runs SET stage = ?, updated_at = ? WHERE key_id = ?").run(stage, nowMs, keyId));
  // PLANNED: 만료일이 지난 key_id
  const ids = (c.prepare("SELECT key_id FROM retained_values UNION SELECT key_id FROM retained_files UNION SELECT key_id FROM key_registry").all() as { key_id: string }[]).map((r) => r.key_id)
    .concat(fs.existsSync(keyDir()) ? fs.readdirSync(keyDir()).map((f) => KEY_RE.exec(f)?.[1]).filter((x): x is string => Boolean(x)) : []);
  for (const k of new Set(ids)) if (keyIdPurgeable(k, nowMs)) out.planned += retainTx(lock, () => c.prepare("INSERT OR IGNORE INTO purge_runs(key_id, stage, updated_at) VALUES(?, 'PLANNED', ?)").run(k, nowMs).changes);
  if (runs().length === 0) return out;
  // CANDIDATE_OK: 진행 줄 모두가 가리키는 후보 세트 하나(진행 중인 모든 key_id가 빠진 세트)가 있어야 한다.
  // PLANNED가 있거나, 후보가 줄마다 다르거나, 후보 세트가 없거나 파기 키를 담고 있으면 새로 만들고 모든 진행 줄을 한 트랜잭션에서 그 세트로 바꾼다
  // param: rs 진행 줄. return: 모든 줄이 같은 후보를 가리키고 그 세트가 유효하면 그 이름, 아니면 null
  const sharedCand = (rs: ReturnType<typeof runs>): string | null => {
    const ids = new Set(rs.map((r) => r.candidate_set_id));
    const id = ids.size === 1 ? [...ids][0] : null;
    if (!id) return null;
    const keys = new Set(rs.map((r) => r.key_id));
    const s = listSets().find((x) => x.name === id && !x.tmp);
    return s && setKeyIds(s.dir).every((k) => !keys.has(k)) ? id : null;
  };
  let candOk = false;
  {
    const rs = runs();
    const needOld = rs.some((r) => r.stage === "PLANNED" || r.stage === "CANDIDATE_OK");
    if (needOld && (rs.some((r) => r.stage === "PLANNED") || !sharedCand(rs))) {
      try {
        const setId = createBackupSet(lock, nowMs); // purge_runs 키는 모두 뺀다
        retainTx(lock, () => c.prepare("UPDATE purge_runs SET stage = CASE WHEN stage = 'PLANNED' THEN 'CANDIDATE_OK' ELSE stage END, candidate_set_id = ?, updated_at = ?").run(setId, nowMs));
        candOk = true;
      } catch (e) {
        if ((e as Error).message === "RETAIN_FENCE_LOST") throw e;
        for (const r of runs()) if (r.stage === "PLANNED" && nowMs - r.updated_at > ORPHAN_MS) console.error(`[retain] 파기 ${r.key_id}가 24시간 넘게 새 백업을 못 만듦(관리자 확인 필요)`, e);
        out.stuck.push(...runs().filter((r) => r.stage === "PLANNED" || r.stage === "CANDIDATE_OK").map((r) => r.key_id));
      }
    }
  }
  if (candOk) retainHooks.purgeStage?.("CANDIDATE_OK");
  // OLD_SETS_GONE: 후보 세트가 아닌 세트와 tmp를 모두 지운 뒤, 남은 세트에 파기 키가 0개인지 다시 읽어 확인
  const cand = sharedCand(runs());
  if (cand && runs().some((r) => r.stage === "CANDIDATE_OK")) {
    beforeFileOp(lock);
    let ok = true;
    for (const s of listSets()) if (s.name !== cand && !removeSet(s.dir)) ok = false;
    const purgeKeys = new Set(runs().map((r) => r.key_id));
    if (ok && listSets().every((s) => setKeyIds(s.dir).every((k) => !purgeKeys.has(k)))) {
      for (const r of runs()) if (r.stage === "CANDIDATE_OK") setStage(r.key_id, "OLD_SETS_GONE");
      retainHooks.purgeStage?.("OLD_SETS_GONE");
    } else {
      console.error("[retain] 옛 보관 백업 세트를 지우지 못해 실제 파기를 미룸");
      out.stuck.push(...runs().filter((r) => r.stage === "CANDIDATE_OK").map((r) => r.key_id));
    }
  }
  // LIVE_PURGED: 직전에 모든 세트(tmp 포함)를 다시 검사해 0개일 때만 실제 줄·사진·키를 지운다
  let deleted = false;
  for (const r of runs().filter((x) => x.stage === "OLD_SETS_GONE")) {
    if (listSets().some((s) => setKeyIds(s.dir).includes(r.key_id))) { setStage(r.key_id, "CANDIDATE_OK"); out.stuck.push(r.key_id); continue; }
    beforeFileOp(lock);
    let filesLeft = 0;
    for (const f of c.prepare("SELECT withdrawn_user_id u, kind, file_name FROM retained_files WHERE key_id = ?").all(r.key_id) as { u: string; kind: string; file_name: string }[]) {
      for (const p of [retainedPath(storeName(f.kind, f.file_name)), retainedStaging(storeName(f.kind, f.file_name))]) { try { fs.rmSync(p, { force: true }); } catch { /* 다음 실행에서 다시 */ } }
      if (fs.existsSync(retainedPath(storeName(f.kind, f.file_name)))) { filesLeft++; continue; }
      retainTx(lock, () => c.prepare("DELETE FROM retained_files WHERE withdrawn_user_id = ? AND kind = ? AND file_name = ?").run(f.u, f.kind, f.file_name));
    }
    retainTx(lock, () => c.prepare("DELETE FROM retained_values WHERE key_id = ?").run(r.key_id));
    deleted = true;
    const left = (c.prepare("SELECT (SELECT COUNT(*) FROM retained_values WHERE key_id = ?) + (SELECT COUNT(*) FROM retained_files WHERE key_id = ?) n").get(r.key_id, r.key_id) as { n: number }).n;
    if (filesLeft > 0 || left > 0) { out.stuck.push(r.key_id); continue; }
    shredKey(path.join(keyDir(), `${r.key_id}.key`));
    retainTx(lock, () => c.prepare("DELETE FROM key_registry WHERE key_id = ?").run(r.key_id));
    setStage(r.key_id, "LIVE_PURGED");
    retainHooks.purgeStage?.("LIVE_PURGED");
  }
  if (deleted) c.exec("VACUUM");
  // DONE: 줄을 지운다
  for (const r of runs().filter((x) => x.stage === "LIVE_PURGED")) { retainTx(lock, () => c.prepare("DELETE FROM purge_runs WHERE key_id = ?").run(r.key_id)); out.done++; }
  return out;
}

// ── 고아 정리(S4) ──
export type SrcPaths = (kind: "listing" | "order", fileName: string) => string[];

// param: lock, nowMs, srcPaths 원본 사진 위치(사진 모듈). return: 정리한 개수
export function cleanupRetainedOrphans(lock: RetainLock, nowMs: number, srcPaths: SrcPaths): number {
  const c = lock.conn;
  let n = 0;
  beforeFileOp(lock);
  for (const r of c.prepare("SELECT withdrawn_user_id u, kind, file_name, src_id, key_id FROM retained_files WHERE state = 'PENDING_FILE'").all() as { u: string; kind: "listing" | "order"; file_name: string; src_id: string; key_id: string }[]) {
    const name = storeName(r.kind, r.file_name);
    const ok = () => retainTx(lock, () => c.prepare("UPDATE retained_files SET state = 'OK' WHERE withdrawn_user_id = ? AND kind = ? AND file_name = ?").run(r.u, r.kind, r.file_name));
    if (fs.existsSync(retainedPath(name))) { ok(); n++; continue; }
    if (fs.existsSync(retainedStaging(name))) { fs.renameSync(retainedStaging(name), retainedPath(name)); fsyncDir(rtDir("retained")); ok(); n++; continue; }
    const src = srcPaths(r.kind, r.file_name);
    if (src.some((p) => fs.existsSync(p))) {
      // 원본이 아직 있다(운영 DB ④ 전): 줄을 지우고 같은 만료일로 다시 만든다
      const y = +r.key_id.slice(0, 4), m = +r.key_id.slice(4, 6) - 1, d = +r.key_id.slice(6, 8);
      retainTx(lock, () => c.prepare("DELETE FROM retained_files WHERE withdrawn_user_id = ? AND kind = ? AND file_name = ?").run(r.u, r.kind, r.file_name));
      putFile(lock, { userId: r.u, kind: r.kind, srcId: r.src_id, fileName: r.file_name, expiresMs: Date.UTC(y, m, d, 12), srcPaths: src }, nowMs);
      n++; continue;
    }
    retainTx(lock, () => c.prepare("DELETE FROM retained_files WHERE withdrawn_user_id = ? AND kind = ? AND file_name = ?").run(r.u, r.kind, r.file_name));
    n++;
  }
  // 줄이 없는 보관 파일(24시간 지난 것), 키 폴더 tmp, 내 것이 아닌 백업 tmp 폴더
  const known = new Set((c.prepare("SELECT kind, file_name FROM retained_files").all() as { kind: string; file_name: string }[]).map((r) => storeName(r.kind, r.file_name)));
  const files = (dir: string) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name) : []);
  const old = (p: string) => nowMs - fs.statSync(p).mtimeMs > ORPHAN_MS;
  for (const f of files(rtDir("retained"))) {
    const p = retainedPath(f);
    if (!known.has(f) && old(p)) { fs.rmSync(p, { force: true }); n++; }
  }
  for (const f of files(rtDir("retained", "staging"))) {
    const p = retainedStaging(f);
    // 줄이 있고 확정본이 이미 있으면 남은 사본, 줄이 없으면 24시간 뒤 지운다
    if ((known.has(f) && fs.existsSync(retainedPath(f))) || (!known.has(f) && old(p))) { fs.rmSync(p, { force: true }); n++; }
  }
  if (fs.existsSync(keyDir())) for (const f of fs.readdirSync(keyDir())) if (f.startsWith("tmp-")) { fs.rmSync(path.join(keyDir(), f), { force: true }); n++; }
  for (const s of listSets()) if (s.tmp) { fs.rmSync(s.dir, { recursive: true, force: true }); n++; }
  return n;
}

// ── 사전 점검(000절 1) ──
// return: 보관 준비가 됐는지(비밀값 32자 이상, 시험 암호화·복호화, 보관 폴더 쓰기, 보관 DB 쓰기·지우기). 하나라도 실패하면 이유
export function retainReady(): { ok: true } | { ok: false; reason: string } {
  try {
    secret();
    const salt = randomBytes(32);
    const box = sealWith(salt, "00000000", "probe");
    const [, , iv, tag, ct] = box.split(".");
    if (decrypt(derive(salt), Buffer.from(iv, "base64url"), Buffer.from(tag, "base64url"), Buffer.from(ct, "base64url"))?.toString("utf8") !== "probe") return { ok: false, reason: "암호화 시험 실패" };
    for (const d of [rtDir("retained", "staging"), keyDir(), backupsDir()]) {
      fs.mkdirSync(d, { recursive: true });
      const p = path.join(d, `probe-${randomBytes(4).toString("hex")}`);
      fs.writeFileSync(p, "x");
      fs.rmSync(p);
    }
    const c = retainedDb();
    c.transaction(() => {
      c.prepare("INSERT INTO key_registry(key_id, sha256, created_at) VALUES('probe', '', 0)").run();
      c.prepare("DELETE FROM key_registry WHERE key_id = 'probe'").run();
    }).immediate();
    return { ok: true };
  } catch (e) {
    console.error("[withdraw] 보관 준비 안 됨", (e as Error).message);
    return { ok: false, reason: (e as Error).message };
  }
}