# -*- coding: utf-8 -*-
# 닉네임은 한 번 정하면 못 바꿈: 가입 안내 문구, MY에 바꾸기 버튼 없음, 서버 403·DB 그대로. 카카오 프로필 기록. argv[1] 복사 DB, argv[2] 캡처, argv[3] 서버 로그
import sys, sqlite3, urllib.request, urllib.parse, json, time
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, F, DB, OUT, LOG = "http://localhost:3200", "http://localhost:3299", sys.argv[1], sys.argv[2], sys.argv[3]
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
def fake(**kw): urllib.request.urlopen(F + "/_set?" + urllib.parse.urlencode(kw)).read()
def q(sql, *a):
    c = sqlite3.connect(DB); r = c.execute(sql, a).fetchall(); c.close(); return r
uid = lambda ctx: next((c["value"].split(".")[0] for c in ctx.cookies() if c["name"] == "sseoboni_sid"), None)
KID = int(time.time()) % 100000 + 200000
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    for tag, vp, kid in [("m", {"width": 375, "height": 812}, KID), ("pc", {"width": 1280, "height": 900}, KID + 1)]:
        c = b.new_context(viewport=vp); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
        c.route("**/*kakaocdn.net/**", lambda r: r.fulfill(status=200, body=open(r"E:\PROJECTS\04_써보니\app\public\icons\icon-192.png", "rb").read(), content_type="image/png"))
        pg = c.new_page(); pg.set_default_timeout(60000); pg.on("pageerror", lambda e: errs.append(str(e)))
        fake(id=kid, nick=f"고정닉{tag}", img="https://k.kakaocdn.net/dn/t/x/img_110x110.jpg")
        pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click(); pg.wait_for_url("**/login?step=kakao**")
        check(f"{tag} 가입 안내: 한 번 정하면 못 바꿈", "한 번 정하면 바꿀 수 없어요" in pg.locator(".login-card").inner_text() and "MY에서 바꿀" not in pg.locator("body").inner_text())
        pg.get_by_role("button", name="카카오 닉네임으로 시작하기").click(); pg.wait_for_url(B + "/")
        me = uid(c)
        pg.goto(B + "/me", wait_until="load")
        check(f"{tag} MY에 닉네임 바꾸기 없음·사진 숨기기는 있음", pg.get_by_role("button", name="닉네임 바꾸기").count() == 0 and pg.get_by_role("button", name="프로필 사진 숨기기").count() == 1)
        pg.locator(".my-head").screenshot(path=f"{OUT}/{tag}_my_nicklock.png")
        r = pg.request.post(B + "/api/session", data=json.dumps({"nickname": "바꾼이름"}), headers={"Content-Type": "application/json"})
        check(f"{tag} 서버로 직접 바꿔도 403·그대로", r.status == 403 and q("select nickname from users where id=?", me)[0][0] == f"고정닉{tag}", r.status)
        c.close()
    log = "".join(l for l in open(LOG, encoding="utf-8", errors="ignore") if "[kakao] 프로필" in l)
    check("카카오 프로필 받음 기록(주소·이름 없음)", "nickname=있음 image=있음" in log and "kakaocdn" not in log and "고정닉" not in log, log[-200:])
    check("화면 오류 없음", not errs, errs[:2])
    print(f"{sum(res)}/{len(res)}")
