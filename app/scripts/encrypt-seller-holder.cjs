/* eslint-disable @typescript-eslint/no-require-imports -- Node 일회성 스크립트(CommonJS) */
// 일회성: 예전 형식 판매자 계좌(account_enc = 계좌번호 문자열, holder = 평문)를
// 새 형식(account_enc = {account, holder} 암호문, holder = 가린 이름)으로 옮긴다. 이미 새 형식이면 건너뛴다.
// 사용: node scripts/encrypt-seller-holder.cjs [--db 경로]   (app/.env의 SESSION_SECRET 사용, 값은 출력하지 않음)
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");

const dbPath = process.argv.includes("--db") ? process.argv[process.argv.indexOf("--db") + 1] : path.join(__dirname, "..", "dev.db");
const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
const secret = (env.match(/^SESSION_SECRET=(.*)$/m)?.[1] ?? "").trim().replace(/^"|"$/g, "");
if (secret.length < 32) { console.error("SESSION_SECRET 없음"); process.exit(1); }
const key = Buffer.from(crypto.hkdfSync("sha256", secret, "sseoboni", "pii-v1", 32)); // crypto-box.ts와 같은 키

function open(box) {
  const [v, iv, tag, ct] = String(box).split(".");
  if (v !== "v1") return null;
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8"));
  } catch { return null; }
}
function seal(value) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}
const mask = (n) => { const c = Array.from(n.trim()); return c.length <= 1 ? "*" : c.length === 2 ? `${c[0]}*` : `${c[0]}${"*".repeat(c.length - 2)}${c[c.length - 1]}`; };

const db = new Database(dbPath);
let moved = 0, skipped = 0, broken = 0;
for (const r of db.prepare("select user_id, account_enc, holder from seller_accounts").all()) {
  const v = open(r.account_enc);
  if (v === null) { broken++; continue; }
  if (typeof v !== "string") { skipped++; continue; }
  db.prepare("update seller_accounts set account_enc = ?, holder = ? where user_id = ?").run(seal({ account: v, holder: r.holder }), mask(r.holder), r.user_id);
  moved++;
}
console.log(`옮김 ${moved} · 이미 새 형식 ${skipped} · 읽을 수 없음 ${broken}`);
