/* eslint-disable @typescript-eslint/no-require-imports -- Node 운영 스크립트(CommonJS) */
// 예전 PC 주소(ngrok → 127.0.0.1:3000)로 들어온 요청을 정식 주소로 보낸다. 같은 경로를 유지한다.
// 예전 주소의 로그인 쿠키(sseoboni_sid)가 유효하면 2분짜리 1회용 서명 표를 붙여 새 주소에서 로그인을 이어받게 한다(/api/auth/carry).
// 브라우저가 이동을 기억하지 않게 302 + no-store로 보낸다(301은 브라우저가 기억해 이 서버를 다시 거치지 않음).
// 사용: node scripts/redirect-to-mwwork.cjs   (app/.env의 SESSION_SECRET 사용, 값은 출력하지 않음)
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const TARGET = process.env.REDIRECT_TARGET || "https://sseoboni.mwwork.co.kr";
const PORT = Number(process.env.REDIRECT_PORT || 3000);
const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
const secret = (env.match(/^SESSION_SECRET=(.*)$/m)?.[1] ?? "").trim().replace(/^"|"$/g, "");
const sign = (payload) => crypto.createHmac("sha256", secret).update(payload).digest("base64url");
const same = (a, b) => { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

// param: header Cookie 헤더. return: 유효한 예전 로그인의 사용자 id 또는 null(session.ts와 같은 서명 방식)
function userFromCookie(header) {
  if (secret.length < 32 || !header) return null;
  const m = header.split(/;\s*/).find((c) => c.startsWith("sseoboni_sid="));
  if (!m) return null;
  const [userId, exp, sig] = decodeURIComponent(m.slice("sseoboni_sid=".length)).split(".");
  if (!userId || !/^\d+$/.test(exp ?? "") || !sig || Number(exp) < Date.now()) return null;
  return same(sig, sign(`${userId}.${exp}`)) ? userId : null;
}

// param: userId 사용자. return: session.ts signValue와 같은 형식의 넘겨받기 표
function carryToken(userId) {
  const body = Buffer.from(JSON.stringify({ k: "carry", u: userId, e: Date.now() + 2 * 60_000, n: crypto.randomBytes(12).toString("hex") })).toString("base64url");
  return `${body}.${sign(body)}`;
}

http
  .createServer((req, res) => {
    const url = req.url && req.url.startsWith("/") ? req.url : "/";
    const userId = req.method === "GET" ? userFromCookie(req.headers.cookie) : null;
    const location = userId
      ? `${TARGET}/api/auth/carry?t=${encodeURIComponent(carryToken(userId))}&next=${encodeURIComponent(url)}`
      : TARGET + url;
    res.writeHead(302, { Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    res.end();
  })
  .listen(PORT, "127.0.0.1", () => console.log(`127.0.0.1:${PORT} → ${TARGET} (로그인 이어받기 ${secret.length >= 32 ? "켜짐" : "꺼짐"})`));
