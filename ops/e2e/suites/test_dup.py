# -*- coding: utf-8 -*-
# 카카오 콜백이 같은 코드로 두 번 와도 로그인 성공(첫 결과 함께 씀), 다른 브라우저가 그 주소로 오면 막힘, 실패 원인 기록. 격리 3200 + 가짜 카카오 3299(코드 1회용)
import sys, urllib.request, urllib.parse, threading
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
import time
KID = int(time.time()) % 100000 + 100000
B, F, LOG = "http://localhost:3200", "http://localhost:3299", sys.argv[1]
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
def fake(**kw): urllib.request.urlopen(F + "/_set?" + urllib.parse.urlencode(kw)).read()
uid = lambda ctx: next((c["value"].split(".")[0] for c in ctx.cookies() if c["name"] == "sseoboni_sid"), None)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def ctx():
        c = b.new_context(viewport={"width": 375, "height": 812}); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
        pg = c.new_page(); pg.set_default_timeout(60000); pg.on("pageerror", lambda e: errs.append(str(e))); return c, pg
    # 기존 카카오 계정 하나 만들기
    c, pg = ctx(); fake(id=KID, nick="두번온다")
    pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click(); pg.wait_for_url("**/login?step=kakao**")
    pg.get_by_role("button", name="카카오 닉네임으로 시작하기").click(); pg.wait_for_url(B + "/"); first = uid(c); c.close()
    # 1) 기존 계정: 콜백 두 번(차례로) → 두 번째도 성공
    c, pg = ctx(); seen = []
    pg.on("request", lambda r: seen.append(r.url) if "/api/auth/kakao/callback" in r.url else None)
    pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click(); pg.wait_for_url(B + "/")
    cb = seen[0]
    pg.goto(cb, wait_until="load")
    check("같은 코드 두 번째 콜백도 로그인 성공(오류 화면 아님)", "kakao=" not in pg.url and uid(c) == first, pg.url)
    # 2) 다른 브라우저가 그 콜백 주소를 그대로 쓰면 막힘(상태 쿠키 없음)
    c2, p2 = ctx(); p2.goto(cb, wait_until="load")
    check("다른 브라우저가 같은 주소로 오면 로그인 안 됨", uid(c2) is None and "kakao=state" in p2.url, p2.url)
    c.close(); c2.close()
    # 3) 동시에 두 번(휴대폰 브라우저처럼) → 마지막 결과도 로그인
    c, pg = ctx(); seen.clear()
    pg.on("request", lambda r: seen.append(r.url) if "/api/auth/kakao/callback" in r.url else None)
    pg.route("**/api/auth/kakao/callback**", lambda r: r.abort())  # 첫 콜백은 막고 주소만 얻기
    pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click(); pg.wait_for_timeout(2000)
    pg.unroute("**/api/auth/kakao/callback**")
    cb = seen[0]; out = []; ck = "; ".join(f"{k['name']}={k['value']}" for k in c.cookies())
    th = [threading.Thread(target=lambda: out.append(urllib.request.build_opener(urllib.request.HTTPRedirectHandler()).open(urllib.request.Request(cb, headers={"Cookie": ck})).geturl())) for _ in range(2)]
    [t.start() for t in th]; [t.join() for t in th]
    check("동시에 두 번 와도 둘 다 홈으로(오류 없음)", len(out) == 2 and all("kakao=" not in u for u in out), out)
    c.close()
    # 4) 진짜 실패면 원인이 서버 기록에 남음(비밀값 없이)
    c, pg = ctx(); fake(id=9702, tokenfail=1)
    pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click(); pg.wait_for_url("**kakao=token**")
    log = "".join(l for l in open(LOG, encoding="utf-8", errors="ignore") if "[kakao]" in l)
    check("토큰 실패 원인 기록·비밀값 없음", "[kakao] token 실패 status=401 error=invalid_grant" in log and "testsecret" not in log and "code_9702" not in log)
    fake(id=9702, tokenfail=0); c.close()
    check("화면 오류 없음", not errs, errs[:2])
    print(f"{sum(res)}/{len(res)}")
