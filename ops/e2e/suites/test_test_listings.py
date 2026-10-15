# -*- coding: utf-8 -*-
# 시험용 상품 10개: 목록에 보임, 상세에 안내·신청 버튼 없음, 신청·제안·의향 API 409, 시장검증 기록 없음. argv[1] 복사 DB, argv[2] 캡처
import sys, sqlite3, urllib.request, urllib.parse, time, json
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, F, DB, OUT = "http://localhost:3200", "http://localhost:3299", sys.argv[1], sys.argv[2]
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
def fake(**kw): urllib.request.urlopen(F + "/_set?" + urllib.parse.urlencode(kw)).read()
def q(sql, *a):
    c = sqlite3.connect(DB); r = c.execute(sql, a).fetchall(); c.close(); return r
rows = q("select id, title, price from listings where title like '[시험용]%' and status='ACTIVE'")
check("시험용 상품 10개", len(rows) == 10, len(rows))
check("시험용 상품 시장검증 기록 없음", q("select count(*) from market_validation_events where listing_id in (select id from listings where title like '[시험용]%')")[0][0] == 0)
check("써보기 조건 10개", q("select count(*) from listing_trial_terms where listing_id in (select id from listings where title like '[시험용]%')")[0][0] == 10)
lid = rows[0][0]
KID = int(time.time()) % 100000 + 500000
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    for tag, vp, kid in [("m", {"width": 375, "height": 812}, KID), ("pc", {"width": 1280, "height": 900}, KID + 1)]:
        c = b.new_context(viewport=vp); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
        pg = c.new_page(); pg.set_default_timeout(60000); pg.on("pageerror", lambda e: errs.append(str(e)))
        fake(id=kid, nick=f"구경꾼{tag}")
        pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click(); pg.wait_for_url("**/login?step=kakao**")
        pg.get_by_role("button", name="카카오 닉네임으로 시작하기").click(); pg.wait_for_url(B + "/")
        pg.goto(B + "/?q=" + urllib.parse.quote("시험용"), wait_until="load")
        check(f"{tag} 검색하면 시험용 상품 보임", pg.locator("a[href^='/listings/']").filter(has_text="[시험용]").count() >= 5)
        pg.goto(B + f"/listings/{lid}", wait_until="load")
        body = pg.locator("body").inner_text()
        check(f"{tag} 상세에 '실제로 판매하지 않아요' 안내", "실제로 판매하지 않아요" in body)
        check(f"{tag} 시험용 상품이 '써보기 조건 참고' 통계에 안 섞임", "등록된 조건 3개" not in body and "써보기 조건 참고" not in body)
        check(f"{tag} 상세에 써보기·구매·의향 버튼 없음", pg.get_by_role("button", name="써보고 싶어요").count() == 0 and pg.get_by_role("button", name="사고 싶어요").count() == 0 and pg.locator(".intent-button").count() == 0)
        pg.screenshot(path=f"{OUT}/{tag}_test_listing.png", full_page=True)
        post = lambda path, data: pg.request.post(B + path, data=json.dumps(data), headers={"Content-Type": "application/json"})
        r1 = post("/api/intents", {"listingId": lid, "kind": "TRY"})
        r2 = post("/api/proposals", {"listingId": lid, "hours": 24, "offerFee": 5000})
        r3 = post("/api/orders", {"listingId": lid, "kind": "BUY"})
        check(f"{tag} 의향·제안·신청 API 모두 막힘(409)", (r1.status, r2.status, r3.status) == (409, 409, 409), (r1.status, r2.status, r3.status, r3.text()[:120]))
        c.close()
    check("시험 뒤에도 시장검증 기록 없음", q("select count(*) from market_validation_events where listing_id in (select id from listings where title like '[시험용]%')")[0][0] == 0)
    check("화면 오류 없음", not errs, errs[:2])
    print(f"{sum(res)}/{len(res)}")
