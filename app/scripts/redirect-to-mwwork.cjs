// 예전 PC 주소(ngrok → 127.0.0.1:3000)로 들어온 요청을 정식 주소로 보낸다. 같은 경로를 유지한다.
// 사용: node scripts/redirect-to-mwwork.cjs
const http = require("node:http");
const TARGET = "https://sseoboni.mwwork.co.kr";
http
  .createServer((req, res) => {
    res.writeHead(301, { Location: TARGET + (req.url || "/") });
    res.end();
  })
  .listen(3000, "127.0.0.1", () => console.log(`127.0.0.1:3000 → ${TARGET}`));
