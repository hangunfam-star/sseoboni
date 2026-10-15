# -*- coding: utf-8 -*-
# MY 메뉴의 로그아웃: 보임 → 누르면 확인창 → 로그아웃 → 카카오로 같은 계정 다시 들어옴(격리 3200 + 가짜 카카오 3299). argv[1] 캡처 폴더
import sys, urllib.request, urllib.parse
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, F, OUT = "http://localhost:3200", "http://localhost:3299", sys.argv[1]
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
def fake(**kw): urllib.request.urlopen(F + "/_set?" + urllib.parse.urlencode(kw)).read()
uid = lambda ctx: next((c["value"].split(".")[0] for c in ctx.cookies() if c["name"] == "sseoboni_sid"), None)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    for tag, vp, kid in [("m", {"width": 375, "height": 812}, 9601), ("pc", {"width": 1280, "height": 900}, 9602)]:
        c = b.new_context(viewport=vp); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
        pg = c.new_page(); pg.set_default_timeout(60000); pg.on("pageerror", lambda e: errs.append(str(e)))
        fake(id=kid, nick=f"나가기{tag}")
        pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click(); pg.wait_for_url("**/login?step=kakao**")
        pg.get_by_role("button", name="카카오 닉네임으로 시작하기").click(); pg.wait_for_url(B + "/")
        first = uid(c)
        pg.goto(B + "/me", wait_until="load")
        btn = pg.locator(".my-menu .my-menu__logout")
        check(f"{tag} MY 메뉴 안에 로그아웃 칸", btn.count() == 1 and "카카오로 다시 들어올 수 있어요" in btn.inner_text())
        btn.scroll_into_view_if_needed(); pg.locator(".my-menu").screenshot(path=f"{OUT}/{tag}_my_menu_logout.png")
        msgs = []
        pg.once("dialog", lambda d: (msgs.append(d.message), d.dismiss()))
        btn.click(); pg.wait_for_timeout(500)
        check(f"{tag} 확인창에서 취소하면 그대로", msgs and uid(c) == first and pg.url.endswith("/me"), msgs)
        pg.once("dialog", lambda d: d.accept())
        btn.click(); pg.wait_for_url("**/login**")
        check(f"{tag} 확인하면 로그아웃·로그인 화면", uid(c) is None)
        pg.goto(B + "/me", wait_until="load")
        check(f"{tag} 로그아웃 뒤 MY는 로그인 안내", pg.get_by_role("link", name="카카오로 로그인하기").count() == 1 and pg.locator(".my-menu").count() == 0)
        pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click(); pg.wait_for_url(B + "/")
        check(f"{tag} 카카오로 같은 계정 다시 들어옴", uid(c) == first)
        c.close()
    check("화면 오류 없음", not errs, errs[:2])
    print(f"{sum(res)}/{len(res)}")
