# -*- coding: utf-8 -*-
# 시험용 상품(is_test): 제목엔 [시험용] 없음, 카드·상세에 작은 "시험용" 표시 하나, 신청·제안·의향 409, 시장검증 기록 없음.
# 준비: run_isolated.sh → node app/scripts/seed-test-listings.cjs <판매자 id> --db <copy.db>. argv[1] 복사 DB, argv[2] 캡처
import sys, sqlite3, urllib.request, urllib.parse, time, json
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, F, DB, OUT = "http://localhost:3200", "http://localhost:3299", sys.argv[1], sys.argv[2]
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
def fake(**kw): urllib.request.urlopen(F + "/_set?" + urllib.parse.urlencode(kw)).read()
def q(sql, *a):
    c = sqlite3.connect(DB); r = c.execute(sql, a).fetchall(); c.close(); return r
rows = q("select id, title, description from listings where is_test=1 and status='ACTIVE'")
check("시험용 상품 10개(is_test)", len(rows) == 10, len(rows))
check("제목·설명에 [시험용]·안내 문구 없음", all("시험용" not in t and "시험용" not in d for _, t, d in rows), [t for _, t, _ in rows][:3])
check("예전 방식 제목 남은 것 없음", q("select count(*) from listings where title like '[시험용]%' and status!='REMOVED'")[0][0] == 0)
check("써보기 조건 10개", q("select count(*) from listing_trial_terms where listing_id in (select id from listings where is_test=1)")[0][0] == 10)
lid, ltitle = rows[0][0], rows[0][1]
KID = int(time.time()) % 100000 + 600000
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    for tag, vp, kid in [("m", {"width": 375, "height": 812}, KID), ("pc", {"width": 1280, "height": 900}, KID + 1)]:
        c = b.new_context(viewport=vp); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
        pg = c.new_page(); pg.set_default_timeout(60000); pg.on("pageerror", lambda e: errs.append(str(e)))
        fake(id=kid, nick=f"구경꾼{tag}")
        pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click(); pg.wait_for_url("**/login?step=kakao**")
        pg.get_by_role("button", name="카카오 닉네임으로 시작하기").click(); pg.wait_for_url(B + "/")
        pg.goto(B + "/?q=" + urllib.parse.quote(ltitle.split()[0]), wait_until="load")
        card = pg.locator(f"a[href='/listings/{lid}']").first
        check(f"{tag} 목록 카드에 작은 '시험용' 표시 하나", card.count() == 1 and card.locator(".test-chip").count() == 1 and card.locator(".test-chip").inner_text() == "시험용")
        card.screenshot(path=f"{OUT}/{tag}_test_card.png")
        pg.goto(B + f"/listings/{lid}", wait_until="load")
        check(f"{tag} 상세 제목 옆 작은 표시 하나·큰 안내 없음", pg.locator("h1 .test-chip").count() == 1 and pg.locator(".test-listing-note").count() == 0 and pg.locator("body").inner_text().count("시험용") == 1)
        check(f"{tag} 상세에 써보기·구매·의향 버튼 없음", pg.locator(".intent-button").count() == 0)
        pg.screenshot(path=f"{OUT}/{tag}_test_listing.png")
        post = lambda path, data: pg.request.post(B + path, data=json.dumps(data), headers={"Content-Type": "application/json"})
        r1 = post("/api/intents", {"listingId": lid, "kind": "TRY"})
        r2 = post("/api/proposals", {"listingId": lid, "hours": 24, "offerFee": 5000})
        r3 = post("/api/orders", {"listingId": lid, "kind": "BUY"})
        check(f"{tag} 의향·제안·신청 API 모두 막힘(409)", (r1.status, r2.status, r3.status) == (409, 409, 409), (r1.status, r2.status, r3.status))
        # Codex v1.5 결함 1: 비용 조회 3가지 행동도 409(기록 없음)
        before = q("select count(*) from market_validation_events")[0][0]
        rc = [post("/api/trial-cost", {"listingId": lid, "action": a, "hours": 24}).status for a in ("VIEW", "STILL_TRY", "DECLINE")]
        check(f"{tag} 비용 조회·그래도 써볼래요·부담돼요 모두 409", rc == [409, 409, 409], rc)
        # 찜·공유·채팅은 동작하되 시장검증 기록은 남지 않음
        w1 = post("/api/wishlists", {"listingId": lid}); w2 = post("/api/wishlists", {"listingId": lid})
        sh = post(f"/api/listings/{lid}/share", {"method": "COPY_LINK"})
        ch = post("/api/chats", {"listingId": lid}); tid = ch.json().get("threadId") if ch.ok else None
        cm = post(f"/api/chats/{tid}", {"body": "시험 메시지예요"}) if tid else None
        check(f"{tag} 찜 넣고 빼기·공유·채팅 시작·메시지 동작", w1.ok and w2.ok and sh.ok and ch.ok and cm is not None and cm.status == 201, (w1.status, w2.status, sh.status, ch.status, cm.status if cm else None))
        after = q("select count(*) from market_validation_events")[0][0]
        check(f"{tag} 위 행동 뒤 시장검증 기록 수 그대로", after == before, (before, after))
        c.close()
    check("시험 뒤에도 시장검증 기록 없음", q("select count(*) from market_validation_events where listing_id in (select id from listings where is_test=1)")[0][0] == 0)
    check("화면 오류 없음", not errs, errs[:2])
    print(f"{sum(res)}/{len(res)}")
