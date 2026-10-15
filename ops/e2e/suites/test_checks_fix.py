# -*- coding: utf-8 -*-
# Codex v1.7 결함 수정 확인: ① 지운 증거 사진은 어디서도 안 열림(별도 폴더·파일 삭제) ② 자동 받음 뒤 표시·24시간 늦은 확인·마감 뒤 막힘.
# 격리 3200 + 가짜 카카오 3299 (bash ops/e2e/run_isolated.sh). argv[1] 복사 DB, argv[2] 캡처
import sys, os, sqlite3, urllib.request, urllib.parse, time, json, re
from datetime import datetime, timezone, timedelta
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, F, DB, OUT = "http://localhost:3200", "http://localhost:3299", sys.argv[1], sys.argv[2]
APP = r"E:\PROJECTS\04_써보니\app"
PHOTO = APP + r"\public\icons\icon-192.png"
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
def fake(**kw): urllib.request.urlopen(F + "/_set?" + urllib.parse.urlencode(kw)).read()
def q(sql, *a):
    c = sqlite3.connect(DB); r = c.execute(sql, a).fetchall(); c.close(); return r
def x(sql, *a):
    c = sqlite3.connect(DB); c.execute(sql, a); c.commit(); c.close()
iso = lambda h: (datetime.now(timezone.utc) + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
KID = int(time.time()) % 100000 + 800000
CH = {"battery": "90% 이상", "screen": "불량 없음", "keys": "모두 정상", "charge": "정상", "look": "흠집 거의 없음", "reset": "보내기 전에 초기화해요"}
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def login(kid, nick, vp):
        c = b.new_context(viewport=vp); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
        pg = c.new_page(); pg.set_default_timeout(60000); pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
        fake(id=kid, nick=nick)
        pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click(); pg.wait_for_url("**/login?step=kakao**")
        pg.get_by_role("button", name="카카오 닉네임으로 시작하기").click(); pg.wait_for_url(B + "/")
        return c, pg
    for tag, vp, k in [("m", {"width": 375, "height": 812}, KID), ("pc", {"width": 1280, "height": 900}, KID + 10)]:
        sc, sp = login(k, f"고침판매{tag}", vp); bc, bp = login(k + 1, f"고침구매{tag}", vp); oc, _ = login(k + 2, f"고침남{tag}", vp)
        sc.request.put(B + "/api/seller-account", data={"bank": "국민", "account": "12345678901234", "holder": "고침판매", "defaultShipping": 3000})
        mid = q("select id from product_models where model_name like 'MacBook Air M2%'")[0][0]
        d = {"modelId": mid, "title": f"고침 시험 {tag}", "price": 300000, "conditionGrade": "A", "description": "설명", "tryWillingness": "YES", "components": ["본체", "충전기"],
             "trialTerms": {"tiers": [{"hours": 24, "fee": 3000}, {"hours": 72, "fee": 8000}], "shippingOneWay": 3000, "conditionNote": ""}, "checkItems": CH}
        ship = {"name": "고침구매", "phone": "01012345678", "address": "서울시 중구 세종대로 1, 101호"}
        up = lambda c, oid, stage: c.request.post(f"{B}/api/orders/{oid}/photos", multipart={"stage": stage, "photo": {"name": "p.png", "mimeType": "image/png", "buffer": open(PHOTO, "rb").read()}})
        def order():
            lid = sc.request.post(B + "/api/listings", data={**d, "title": f"고침 시험 {tag} {time.time()}"}).json()["listing"]["id"]
            oid = bc.request.post(B + "/api/orders", data={"listingId": lid, "kind": "TRIAL", "hours": 24, "shipTo": ship}).json()["orderId"]
            sc.request.patch(f"{B}/api/orders/{oid}", data={"action": "CONFIRM_PAYMENT"}); sc.request.patch(f"{B}/api/orders/{oid}", data={"action": "SHIP", "carrier": "CJ대한통운", "tracking": "123456789012"})
            return oid
        # ① 증거 사진 삭제
        oid = order()
        f1 = up(bc, oid, "RECEIVE").json()["photos"][0]
        check(f"{tag} 증거 사진은 별도 폴더에 저장(공개 폴더엔 없음)", os.path.exists(os.path.join(APP, "runtime-data", "order-uploads", f1)) and not os.path.exists(os.path.join(APP, "runtime-data", "uploads", f1)))
        check(f"{tag} 지우기 전에도 공개 주소로는 안 열림(404)", oc.request.get(f"{B}/api/photos/{f1}").status == 404)
        rd = bc.request.delete(f"{B}/api/orders/{oid}/photos?stage=RECEIVE&file={f1}")
        check(f"{tag} 지우면 파일도 사라짐", rd.ok and not os.path.exists(os.path.join(APP, "runtime-data", "order-uploads", f1)))
        check(f"{tag} 지운 사진: 공개 주소 404·거래 주소 404", oc.request.get(f"{B}/api/photos/{f1}").status == 404 and bc.request.get(f"{B}/api/orders/{oid}/photos/{f1}").status == 404)
        # ② 자동 받음: 발송을 5일+1시간 전으로 돌려 자동 처리(24시간 써보기는 아직 진행 중)
        x("update orders set shipped_at=? where id=?", iso(-24 * 5 - 1), oid)
        bp.goto(B + f"/orders/{oid}", wait_until="load")
        st = q("select status, arrival_check from orders where id=?", oid)[0]
        check(f"{tag} 자동 받음 → 써보는 중·확인 없음", st[0] == "TRIAL" and st[1] is None, st)
        rec = bp.locator(".check-compare")
        check(f"{tag} 상태 기록에 '자동 받음 · 구매자 확인·사진 없음'", "자동 받음 · 구매자 확인·사진 없음" in rec.inner_text())
        check(f"{tag} 구매자에게 늦은 확인 양식(마감 안내)", bp.get_by_role("button", name="받은 물건 확인 올리기").count() == 1 and "판매자 등록 사진·점검표가 상태 기준" in bp.locator(".order-todo").inner_text())
        check(f"{tag} 자동 받음 채팅 안내(24시간·기준)", q("select count(*) from chat_messages where body like '%구매자 확인 없이 처리돼서 24시간 안에%'")[0][0] >= 1)
        r0 = bc.request.patch(f"{B}/api/orders/{oid}", data={"action": "ARRIVAL_CHECK", "components": {"본체": True}, "matches": True})
        check(f"{tag} 늦은 확인도 써보기는 사진 없으면 400", r0.status == 400 and "사진" in r0.json()["error"])
        check(f"{tag} 판매자는 늦은 확인 못 올림(409)", sc.request.patch(f"{B}/api/orders/{oid}", data={"action": "ARRIVAL_CHECK", "matches": True}).status == 409)
        bp.get_by_label(re.compile("본체 왔어요")).check(); bp.get_by_label(re.compile("충전기 왔어요")).check(); bp.get_by_role("button", name="같아요").click()
        bp.locator(".stage-photo-add input").set_input_files(PHOTO); bp.wait_for_selector(".stage-photo img")
        bp.screenshot(path=f"{OUT}/{tag}_late_arrival.png", full_page=True)
        bp.get_by_role("button", name="받은 물건 확인 올리기").click(); bp.wait_for_timeout(2500)
        ac = q("select arrival_check, status from orders where id=?", oid)[0]
        a = json.loads(ac[0]) if ac[0] else {}
        check(f"{tag} 늦은 확인 저장(late·사진·상태 그대로)", a.get("late") is True and len(a.get("photos", [])) == 1 and ac[1] == "TRIAL", ac)
        check(f"{tag} 두 번은 못 올림(409)", bc.request.patch(f"{B}/api/orders/{oid}", data={"action": "ARRIVAL_CHECK", "components": {}, "matches": True}).status == 409)
        sp.goto(B + f"/orders/{oid}", wait_until="load")
        check(f"{tag} 판매자 화면: '자동 받음 뒤 늦게 확인' 표시", "자동 받음 뒤 늦게 확인" in sp.locator(".check-compare").inner_text())
        # 마감 지난 경우
        oid2 = order()
        x("update orders set shipped_at=? where id=?", iso(-24 * 5 - 1), oid2)
        bc.request.get(f"{B}/api/orders/{oid2}")  # 자동 받음 처리
        x("update order_events set created_at=datetime('now','-25 hours') where order_id=? and type='AUTO_RECEIVED'", oid2)  # 처리한 지 25시간 지난 것으로
        check(f"{tag} 24시간 지나면 늦은 확인 409·사진 409", bc.request.patch(f"{B}/api/orders/{oid2}", data={"action": "ARRIVAL_CHECK", "matches": True}).status == 409 and up(bc, oid2, "RECEIVE").status == 409)
        bp.goto(B + f"/orders/{oid2}", wait_until="load")
        check(f"{tag} 마감 뒤: 양식 없음·'판매자 등록 사진·점검표가 상태 기준이에요'", bp.get_by_role("button", name="받은 물건 확인 올리기").count() == 0 and "판매자 등록 사진·점검표가 상태 기준이에요." in bp.locator(".check-compare").inner_text())
        sc.close(); bc.close(); oc.close()
    check("화면 오류 없음", not errs, errs[:2])
    print(f"{sum(res)}/{len(res)}")
