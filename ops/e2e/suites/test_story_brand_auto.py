# -*- coding: utf-8 -*-
# 상단 영상 높이·닫기/열기, 브랜드·정렬 누를 때 스크롤 유지, 더 보기 없이 자동 불러오기(홈·MY). 격리 3200, 복사 DB. argv[1] 캡처
import sys, time, hmac, hashlib, base64
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, OUT = "http://localhost:3200", sys.argv[1]
ENV = {l.split("=", 1)[0]: l.split("=", 1)[1].strip().strip('"') for l in open(r"E:\PROJECTS\04_써보니\app\.env", encoding="utf-8") if "=" in l and not l.startswith("#")}
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    for tag, vp in [("m", {"width": 375, "height": 812}), ("pc", {"width": 1280, "height": 900})]:
        c = b.new_context(viewport=vp); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
        pg = c.new_page(); pg.set_default_timeout(60000); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(B + "/", wait_until="load"); pg.wait_for_timeout(1000)
        box = pg.locator(".home-story").bounding_box()
        check(f"{tag} 영상 높이 줄어듦(가로:세로 4:3 이하)", box and box["height"] <= box["width"] * 0.76 + 2, box)
        pg.get_by_role("button", name="소개 영상 닫기").click(); pg.wait_for_timeout(300)
        check(f"{tag} 닫으면 한 줄로 접힘", pg.locator(".home-story--closed").count() == 1 and pg.locator("video").count() == 0)
        pg.locator(".home-story--closed").screenshot(path=f"{OUT}/{tag}_story_closed.png")
        pg.reload(wait_until="load"); pg.wait_for_timeout(1000)
        check(f"{tag} 새로고침해도 접힘 유지", pg.locator(".home-story--closed").count() == 1)
        pg.locator(".home-story__reopen").click(); pg.wait_for_timeout(500)
        check(f"{tag} 접힌 줄 누르면 다시 영상", pg.locator("video").count() == 1 and pg.get_by_role("button", name="소개 영상 닫기").count() == 1)
        pg.locator(".home-story").screenshot(path=f"{OUT}/{tag}_story_open.png")
        # 브랜드·정렬: 누른 뒤에도 화면 위치 유지
        pg.locator(".brand-section").scroll_into_view_if_needed(); pg.wait_for_timeout(300)
        y0 = pg.evaluate("scrollY")
        pg.locator(".brand-tile").nth(1).click(); pg.wait_for_url(lambda u: "b=" in u); pg.wait_for_timeout(800)
        y1 = pg.evaluate("scrollY")
        check(f"{tag} 브랜드 누르면 맨 위로 안 감", y0 > 200 and abs(y1 - y0) < 120, (y0, y1))
        pg.locator(".brand-tile[aria-current='true']").click(); pg.wait_for_url(lambda u: "b=" not in u); pg.wait_for_timeout(800)
        check(f"{tag} 브랜드 해제도 위치 유지", abs(pg.evaluate("scrollY") - y0) < 120, (y0, pg.evaluate("scrollY")))
        y2 = pg.evaluate("scrollY"); pg.locator(".feed-tab").nth(1).click(); pg.wait_for_url(lambda u: "s=popular" in u); pg.wait_for_timeout(800)
        check(f"{tag} 정렬 탭 눌러도 위치 유지", abs(pg.evaluate("scrollY") - y2) < 120, (y2, pg.evaluate("scrollY")))
        pg.locator(".feed-tab").nth(0).click(); pg.wait_for_timeout(800)
        # 자동 불러오기: 더 보기 버튼 없음, 끝까지 내리면 늘어남
        check(f"{tag} 더 보기 버튼 없음", pg.locator(".more-link").count() == 0)
        cards = lambda: pg.locator("a[href^='/listings/']").count()
        n0 = cards(); y = pg.evaluate("scrollY")
        for _ in range(3):
            pg.evaluate("window.scrollTo(0, document.body.scrollHeight)"); pg.wait_for_timeout(2500)
        n1 = cards()
        check(f"{tag} 끝까지 내리면 상품 저절로 늘어남", n1 > n0, (n0, n1))
        check(f"{tag} 불러오는 동안 위치 유지(맨 위로 안 감)", pg.evaluate("scrollY") > 500, pg.evaluate("scrollY"))
        pg.screenshot(path=f"{OUT}/{tag}_autoload.png")
        # MY 내 상품도 자동 불러오기(상품 많은 한군 계정, 격리 서버 쿠키 서명)
        uid = "u_2f2845deba396e0cfae738ac"; exp = str(int(time.time() * 1000) + 3600_000)
        sig = base64.urlsafe_b64encode(hmac.new(ENV["SESSION_SECRET"].encode(), f"{uid}.{exp}".encode(), hashlib.sha256).digest()).decode().rstrip("=")
        c2 = b.new_context(viewport=vp); c2.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
        c2.add_cookies([{"name": "sseoboni_sid", "value": f"{uid}.{exp}.{sig}", "url": B}])
        p2 = c2.new_page(); p2.set_default_timeout(60000); p2.on("pageerror", lambda e: errs.append(str(e)))
        p2.goto(B + "/me", wait_until="load")
        m0 = p2.locator(".my-listing").count()
        for _ in range(3):
            p2.evaluate("window.scrollTo(0, document.body.scrollHeight)"); p2.wait_for_timeout(2500)
        m1 = p2.locator(".my-listing").count()
        check(f"{tag} MY 내 상품도 자동으로 늘어남·더 보기 없음", m1 > m0 and p2.locator(".more-link").count() == 0, (m0, m1))
        c.close(); c2.close()
    check("화면 오류 없음", not errs, errs[:2])
    print(f"{sum(res)}/{len(res)}")
