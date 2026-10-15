// 시험용 가짜 푸시 서비스(기본 포트 3298 — 3299는 가짜 카카오). 받은 알림을 기기 비밀키로 복호화해 기록한다.
// GET /_keys → 새 기기 키(공개키·auth) 발급, POST /push/<id> → 받기(201), POST /gone/<id> → 410, GET /_log → 받은 것, GET /_clear
// 사용: node fake_push.cjs <app 폴더> [포트]
const http = require("node:http");
const crypto = require("node:crypto");
const path = require("node:path");
const ece = require(require.resolve("http_ece", { paths: [process.argv[2]] }));
const devices = new Map(); // id → { ecdh, auth }
let log = [];
const b64u = (b) => Buffer.from(b).toString("base64url");
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (req.method === "GET" && u.pathname === "/_keys") {
    const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
    const auth = crypto.randomBytes(16); const id = crypto.randomBytes(6).toString("hex");
    devices.set(id, { ecdh, auth });
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ id, p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) }));
  }
  if (u.pathname === "/_log") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify(log)); }
  if (u.pathname === "/_clear") { log = []; res.writeHead(200); return res.end("ok"); }
  const m = u.pathname.match(/^\/(push|gone)\/([0-9a-f]+)$/);
  if (req.method === "POST" && m) {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks); const d = devices.get(m[2]);
      let text = null, err = null;
      try { text = d ? ece.decrypt(body, { version: "aes128gcm", privateKey: d.ecdh, authSecret: d.auth }).toString("utf8") : null; } catch (e) { err = String(e.message || e); }
      log.push({ path: u.pathname, id: m[2], status: m[1] === "gone" ? 410 : 201, enc: req.headers["content-encoding"], ttl: req.headers["ttl"], urgency: req.headers["urgency"], vapid: /^vapid t=.+, k=.+/.test(req.headers["authorization"] || ""), text, err });
      res.writeHead(m[1] === "gone" ? 410 : 201); res.end();
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(Number(process.argv[3] || 3298), "127.0.0.1", () => console.log("fake push", process.argv[3] || 3298));
