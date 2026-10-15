# -*- coding: utf-8 -*-
# 시험용 가짜 카카오 서버(실제 카카오와 같은 경로·형식). 포트 3299.
# /_set?id=1001 다음 로그인할 카카오 회원번호, /_set?deny=1 동의 취소, /_set?tokenfail=1 토큰 발급 실패, /_last 마지막 요청 확인
import json, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, urlencode
STATE = {"id": "1001", "deny": False, "tokenfail": False, "nick": "", "img": "", "defimg": False, "last": {}}
KEY, SECRET = "testkey", "testsecret"
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body=None, headers=None):
        self.send_response(code)
        for k, v in (headers or {}).items(): self.send_header(k, v)
        data = json.dumps(body).encode() if body is not None else b""
        if body is not None: self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path == "/_set":
            if "id" in q: STATE["id"] = q["id"]
            STATE["deny"] = q.get("deny") == "1"; STATE["tokenfail"] = q.get("tokenfail") == "1"; STATE["nick"] = q.get("nick", ""); STATE["img"] = q.get("img", ""); STATE["defimg"] = q.get("defimg") == "1"
            return self.send(200, {"ok": True, **{k: STATE[k] for k in ("id", "deny", "tokenfail")}})
        if u.path == "/_last": return self.send(200, STATE["last"])
        if u.path == "/oauth/authorize":
            STATE["last"]["authorize"] = q
            if q.get("client_id") != KEY or q.get("response_type") != "code": return self.send(400, {"error": "bad request"})
            p = {"state": q.get("state", "")}
            if STATE["deny"]: p.update(error="access_denied", error_description="User denied access")
            else:
                STATE["n"] = STATE.get("n", 0) + 1; p["code"] = f"code_{STATE['id']}_{STATE['n']}"  # 실제처럼 매번 새 1회용 코드
            return self.send(302, None, {"Location": q["redirect_uri"] + "?" + urlencode(p)})
        if u.path == "/v2/user/me":
            auth = self.headers.get("Authorization", "")
            if not auth.startswith("Bearer tok_"): return self.send(401, {"msg": "this access token does not exist"})
            body = {"id": int(auth[len("Bearer tok_"):]), "connected_at": "2026-10-10T00:00:00Z"}
            prof = {}
            if STATE["nick"]: prof["nickname"] = STATE["nick"]
            if STATE["img"]: prof.update(thumbnail_image_url=STATE["img"], profile_image_url=STATE["img"], is_default_image=STATE["defimg"])
            if prof: body["kakao_account"] = {"profile": prof}
            return self.send(200, body)
        self.send(404, {"error": "not found"})
    def do_POST(self):
        u = urlparse(self.path)
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()
        q = {k: v[0] for k, v in parse_qs(body).items()}
        if u.path == "/oauth/token":
            STATE["last"]["token"] = {k: ("***" if k == "client_secret" else v) for k, v in q.items()}
            STATE["last"]["token_secret_ok"] = q.get("client_secret") == SECRET
            ok = (not STATE["tokenfail"] and q.get("grant_type") == "authorization_code" and q.get("client_id") == KEY
                  and q.get("client_secret") == SECRET and q.get("code", "").startswith("code_")
                  and q.get("redirect_uri") == STATE["last"].get("authorize", {}).get("redirect_uri"))
            if not ok: return self.send(401, {"error": "invalid_grant"})
            used = STATE.setdefault("used", set())
            if q["code"] in used: return self.send(400, {"error": "invalid_grant", "error_code": "KOE320"})  # 이미 쓴 코드
            used.add(q["code"])
            return self.send(200, {"access_token": "tok_" + q["code"][len("code_"):].split("_")[0], "token_type": "bearer", "expires_in": 21599})
        self.send(404, {"error": "not found"})
ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 3299), H).serve_forever()
