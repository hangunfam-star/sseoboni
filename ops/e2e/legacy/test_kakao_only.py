# -*- coding: utf-8 -*-
# 닉네임으로 시작 없애고 카카오 로그인만(격리 3200 + 가짜 카카오 3299, 닉네임 새 계정 허용 끔). argv[1] 복사 DB, argv[2] 캡처
# 실행: 이 시험만 NICK=0(기본) — bash ops/e2e/run_isolated.sh. NICK=1로 띄우면 "닉네임만으로 새 계정 막힘"이 실패한다.
import sys, sqlite3, urllib.request, time
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, F, DB, OUT = "http://localhost:3200", "http://localhost:3299", sys.argv[1], sys.argv[2]
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
def fake(**kw): urllib.request.urlopen(F + "/_set?" + "&".join(f"{k}={v}" for k, v in kw.items())).read()
def q(sql, *a):
    c = sqlite3.connect(DB); r = c.execute(sql, a).fetchall(); c.close(); return r
uid = lambda ctx: next((c["value"].split(".")[0] for c in ctx.cookies() if c["name"] == "sseoboni_sid"), None)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    for tag, vp, base in [("m", {"width": 375, "height": 812}, 17000), ("pc", {"width": 1280, "height": 900}, 18000)]:
        def ctx():
            c = b.new_context(viewport=vp); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
            return c
        c = ctx(); pg = c.new_page(); pg.set_default_timeout(60000); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(B + "/login", wait_until="load")
        body = pg.locator("body").inner_text()
        check(f"{tag} 시작 화면: 카카오 버튼만·닉네임 입력 없음", pg.locator(".kakao-button").count() == 1 and pg.locator("input").count() == 0 and "닉네임 정하고" not in body and "또는 닉네임" not in body)
        check(f"{tag} 시작 화면: 베타테스터 미션 유지", "베타테스터 미션" in body)
        pg.screenshot(path=f"{OUT}/{tag}_login_kakao_only.png", full_page=True)
        r = c.request.post(B + "/api/session", data={"nickname": "닉네임가입"})
        check(f"{tag} 닉네임만으로 새 계정 막힘(403)", r.status == 403 and "카카오" in r.json().get("error", ""), r.status)
        # 로그아웃 상태 화면 문구
        for path in ["/me", "/wishlist", "/chats", "/orders", "/notifications"]:
            pg.goto(B + path, wait_until="load"); t = pg.locator("main").inner_text()
            ok = "카카오로 로그인" in t and "닉네임" not in t.replace("예전에 닉네임으로 쓰던", "")
            if not ok: break
        check(f"{tag} 로그아웃 화면 5곳 카카오 로그인 안내", ok, (path, t[:120]))
        pg.goto(B + "/me", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인하기").click(); pg.wait_for_url("**/login", timeout=60000)
        check(f"{tag} 로그인하기 링크 → 시작 화면", pg.url.endswith("/login"))
        # 처음 온 사람: 카카오 → 닉네임 정하기 → 홈
        fake(id=base + 1)
        pg.get_by_role("link", name="카카오로 로그인").click(); pg.wait_for_url("**/login?step=kakao**", timeout=60000)
        check(f"{tag} 카카오 뒤 닉네임 정하기 단계", pg.locator("input").count() == 1 and "닉네임을 정해 주세요" in pg.locator("body").inner_text())
        pg.screenshot(path=f"{OUT}/{tag}_nickname_step.png", full_page=True)
        pg.fill("input", "가"); pg.get_by_role("button", name="이 닉네임으로 시작하기").click(); pg.wait_for_timeout(800)
        check(f"{tag} 1글자 닉네임 오류", "2~12자" in pg.locator("body").inner_text())
        pg.fill("input", f"카카오첫{tag}"); pg.keyboard.press("Enter"); pg.wait_for_url(B + "/", timeout=60000)
        u = uid(c)
        check(f"{tag} 가입 완료·카카오 연결", u and q("select count(*) from social_accounts where user_id=?", u)[0][0] == 1)
        # 닉네임은 한 번 정하면 못 바꿈(사용자 결정 2026-10-14): MY에 바꾸기 버튼 없음, 서버도 403, DB 그대로
        pg.goto(B + "/me", wait_until="load")
        check(f"{tag} MY에 닉네임 바꾸기 버튼 없음", pg.get_by_role("button", name="닉네임 바꾸기").count() == 0 and pg.locator("#nickname-edit-input").count() == 0)
        check(f"{tag} MY 제목에 정한 닉네임", f"카카오첫{tag}" in pg.locator(".my-title").inner_text())
        r = pg.request.post(B + "/api/session", data={"nickname": f"바뀐이름{tag}"})
        check(f"{tag} 서버로 직접 바꿔도 403", r.status == 403, r.status)
        check(f"{tag} DB 닉네임 그대로", q("select nickname from users where id=?", u)[0][0] == f"카카오첫{tag}")
        pg.screenshot(path=f"{OUT}/{tag}_my_nickname.png")
        # 다시 로그인하면 닉네임 단계 없이 바로
        c2 = ctx(); p2 = c2.new_page(); p2.set_default_timeout(60000); fake(id=base + 1)
        p2.goto(B + "/login", wait_until="load"); p2.get_by_role("link", name="카카오로 로그인").click(); p2.wait_for_url(B + "/", timeout=60000)
        check(f"{tag} 다시 로그인하면 바로 같은 계정", uid(c2) == u)
        # 로그아웃 상태 찜 누르기 안내
        c3 = ctx(); p3 = c3.new_page(); p3.set_default_timeout(60000)
        lid = q("select id from listings where status='ACTIVE' limit 1")[0][0]
        p3.goto(f"{B}/listings/{lid}", wait_until="load"); msgs = []
        p3.on("dialog", lambda d: (msgs.append(d.message), d.dismiss()))
        p3.get_by_role("button", name="찜").first.click(); p3.wait_for_timeout(1000)
        check(f"{tag} 로그아웃 상태 찜 → 카카오 로그인 안내", msgs and "카카오로 로그인" in msgs[0], msgs)
        for x in (c, c2, c3): x.close()
    check("화면 오류 없음", not errs, errs[:2])
    print(f"{sum(res)}/{len(res)}")
