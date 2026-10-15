# -*- coding: utf-8 -*-
# 상품 점검·반품 확인(2026-10-15): 등록 점검표(써보기 필수), 상세 표시, 수정 화면, 받을 때 확인, 반송 전 확인, 판매자 검수(상태·사진), 증거 사진 접근 제한.
# 격리 3200 + 가짜 카카오 3299 (bash ops/e2e/run_isolated.sh). argv[1] 복사 DB, argv[2] 캡처
import sys, sqlite3, urllib.request, urllib.parse, time, json, re
from datetime import datetime, timezone, timedelta
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, F, DB, OUT = "http://localhost:3200", "http://localhost:3299", sys.argv[1], sys.argv[2]
PHOTO = r"E:\PROJECTS\04_써보니\app\public\icons\icon-192.png"
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
def fake(**kw): urllib.request.urlopen(F + "/_set?" + urllib.parse.urlencode(kw)).read()
def q(sql, *a):
    c = sqlite3.connect(DB); r = c.execute(sql, a).fetchall(); c.close(); return r
KID = int(time.time()) % 100000 + 700000
TODAY = datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d")
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def login(kid, nick, vp):
        c = b.new_context(viewport=vp); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
        pg = c.new_page(); pg.set_default_timeout(60000); pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
        fake(id=kid, nick=nick)
        pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click(); pg.wait_for_url("**/login?step=kakao**")
        pg.get_by_role("button", name="카카오 닉네임으로 시작하기").click(); pg.wait_for_url(B + "/")
        return c, pg
    api = lambda c: c.request
    for tag, vp, k in [("m", {"width": 375, "height": 812}, KID), ("pc", {"width": 1280, "height": 900}, KID + 10)]:
        sc, sp = login(k, f"점검판매{tag}", vp)
        bc, bp = login(k + 1, f"점검구매{tag}", vp)
        oc, _ = login(k + 2, f"남{tag}", vp)
        api(sc).put(B + "/api/seller-account", data={"bank": "국민", "account": "12345678901234", "holder": "점검판매", "defaultShipping": 3000})
        # 1) 등록: 써보기 상품은 점검표 필수
        sp.goto(B + "/listings/new", wait_until="load"); sp.wait_for_timeout(1200)
        sp.locator(".model-picker input").fill("맥북"); sp.wait_for_timeout(300); sp.locator(".model-picker__list [role=option]").first.click()
        sp.get_by_placeholder("예: 맥북 에어 M2 16GB 512GB 풀박스").fill(f"점검 시험 맥북 {tag}")
        sp.locator(".price-input input").fill("500000")
        sp.locator("textarea").fill("점검 시험용 설명이에요")
        sp.get_by_role("button", name="써보기 허용").click()
        check(f"{tag} 등록: 노트북 점검표 6항목 보임", sp.locator(".check-fields .check-row").count() == 6 and "모두 채워 주세요" in sp.locator(".check-fields legend").inner_text())
        sp.screenshot(path=f"{OUT}/{tag}_new_checks.png", full_page=True)
        d = {"modelId": q("select id from product_models where model_name like 'MacBook Air M2%'")[0][0], "title": f"점검API {tag}", "price": 500000, "conditionGrade": "A", "description": "설명", "tryWillingness": "YES", "components": ["본체", "충전기"],
             "trialTerms": {"tiers": [{"hours": 24, "fee": 5000}, {"hours": 72, "fee": 12000}], "shippingOneWay": 3000, "conditionNote": ""}}
        r0 = api(sc).post(B + "/api/listings", data=d)
        check(f"{tag} 등록 API: 써보기인데 점검표 없으면 400", r0.status == 400 and "점검표" in r0.json().get("error", ""), r0.status)
        r1 = api(sc).post(B + "/api/listings", data={**d, "checkItems": {"battery": "100%"}})
        check(f"{tag} 등록 API: 없는 선택값 400", r1.status == 400, r1.status)
        CH = {"battery": "80~89%", "screen": "불량 없음", "keys": "모두 정상", "charge": "정상", "look": "작은 흠집 있음", "reset": "보내기 전에 초기화해요"}
        r2 = api(sc).post(B + "/api/listings", data={**d, "checkItems": CH}); lid = r2.json()["listing"]["id"]
        check(f"{tag} 등록 API: 점검표 채우면 저장", r2.status == 201 and len(json.loads(q("select check_items from listings where id=?", lid)[0][0])) == 6)
        r3 = api(sc).post(B + "/api/listings", data={**d, "title": f"바로판매 {tag}", "tryWillingness": "NO", "trialTerms": None})
        check(f"{tag} 바로 판매는 점검표 없어도 등록", r3.status == 201, r3.status)
        bp.goto(B + f"/listings/{lid}", wait_until="load")
        check(f"{tag} 상세에 판매자 점검표", bp.locator("#seller-check-title").count() == 1 and "80~89%" in bp.locator(".check-list").inner_text())
        sp.goto(B + f"/listings/{lid}/edit", wait_until="load")
        try: sp.wait_for_selector(".check-row__options button[aria-pressed='true']", timeout=30000)
        except Exception: pass
        check(f"{tag} 수정 화면에 저장된 점검표", sp.locator(".check-row__options button[aria-pressed='true']").count() == 6)
        # 2) 거래: 신청 → 입금 확인 → 발송
        oid = api(bc).post(B + "/api/orders", data={"listingId": lid, "kind": "TRIAL", "hours": 24, "shipTo": {"name": "점검구매", "phone": "01012345678", "address": "서울시 중구 세종대로 1, 101호"}}).json()["orderId"]
        check(f"{tag} 신청 때 점검표가 거래 기록에 고정", len(json.loads(q("select snapshot from orders where id=?", oid)[0][0]).get("checks", [])) == 6)
        api(sc).patch(f"{B}/api/orders/{oid}", data={"action": "CONFIRM_PAYMENT"}); api(sc).patch(f"{B}/api/orders/{oid}", data={"action": "SHIP", "carrier": "CJ대한통운", "tracking": "123456789012"})
        # 증거 사진 권한
        up = lambda c, stage: api(c).post(f"{B}/api/orders/{oid}/photos", multipart={"stage": stage, "photo": {"name": "p.png", "mimeType": "image/png", "buffer": open(PHOTO, "rb").read()}})
        check(f"{tag} 판매자는 받을 때 사진 못 올림(409)", up(sc, "RECEIVE").status == 409)
        check(f"{tag} 지금 단계가 아닌 포장 사진 못 올림(409)", up(bc, "PACK").status == 409)
        check(f"{tag} 남은 거래 사진 못 올림(404)", up(oc, "RECEIVE").status == 404)
        # 3) 받을 때 확인(화면)
        bp.goto(B + f"/orders/{oid}", wait_until="load")
        check(f"{tag} 받을 때: 사진·같은지 고르기 전엔 버튼 꺼짐", bp.get_by_role("button", name="받았어요").is_disabled())
        rbad = api(bc).patch(f"{B}/api/orders/{oid}", data={"action": "RECEIVED", "components": {"본체": True}, "matches": False, "note": "ㄴ"})
        check(f"{tag} 받을 때 API: 다르다면 5자 이상 필요", rbad.status == 400)
        rnop = api(bc).patch(f"{B}/api/orders/{oid}", data={"action": "RECEIVED", "components": {}, "matches": True})
        check(f"{tag} 받을 때 API: 써보기는 사진 없으면 400", rnop.status == 400 and "사진" in rnop.json()["error"])
        bp.get_by_label(re.compile("본체 왔어요")).check()
        bp.get_by_role("button", name="달라요").click(); bp.get_by_label("다른 점").fill("충전기가 상자에 없었어요")
        bp.locator(".stage-photo-add input").set_input_files(PHOTO); bp.wait_for_selector(".stage-photo img")
        bp.screenshot(path=f"{OUT}/{tag}_arrival.png", full_page=True)
        bp.get_by_role("button", name="받았어요").click(); bp.wait_for_function("document.body.innerText.includes('써보는 중')", timeout=20000)
        ac = json.loads(q("select arrival_check from orders where id=?", oid)[0][0])
        check(f"{tag} 받을 때 확인 저장(충전기 안 옴·다름·사진)", ac["matches"] is False and [x["ok"] for x in ac["items"]] == [True, False] and len(ac["photos"]) == 1)
        check(f"{tag} 다름·빠진 구성품이 채팅 안내로", q("select count(*) from chat_messages where body like '%빠진 구성품 충전기%설명과 다름%'")[0][0] >= 1)
        pf = ac["photos"][0]
        check(f"{tag} 증거 사진: 공개 주소로는 안 열림(404)", api(oc).get(f"{B}/api/photos/{pf}").status == 404)
        check(f"{tag} 증거 사진: 남은 못 봄(404)·당사자는 봄(200)", api(oc).get(f"{B}/api/orders/{oid}/photos/{pf}").status == 404 and api(sc).get(f"{B}/api/orders/{oid}/photos/{pf}").status == 200)
        # 4) 반납 신청 → 반송 전 확인(화면)
        api(bc).patch(f"{B}/api/orders/{oid}", data={"action": "RETURN", "reason": "HEAVY", "refundAccount": {"bank": "신한", "account": "11122233344", "holder": "점검구매"}})
        bp.goto(B + f"/orders/{oid}", wait_until="load")
        bp.get_by_label("반송 택배사").select_option("우체국택배"); bp.get_by_label("반송 송장번호").fill("6070001112223")
        rnr = api(bc).patch(f"{B}/api/orders/{oid}", data={"action": "RETURN_SHIPPED", "carrier": "우체국택배", "tracking": "6070001112223", "handoverDate": TODAY, "packed": {"본체": True}})
        check(f"{tag} 반송 API: 노트북은 초기화 체크 없으면 400", rnr.status == 400 and "초기화" in rnr.json()["error"])
        check(f"{tag} 반송: 포장 사진·초기화 전엔 버튼 꺼짐", bp.get_by_role("button", name="반송했어요").is_disabled())
        bp.get_by_label(re.compile("본체 넣었어요")).check(); bp.get_by_label(re.compile("초기화·계정 로그아웃")).check()
        bp.locator(".stage-photo-add input").set_input_files(PHOTO); bp.wait_for_selector(".stage-photo img")
        bp.screenshot(path=f"{OUT}/{tag}_pack.png", full_page=True)
        bp.get_by_role("button", name="반송했어요").click(); bp.wait_for_function("document.body.innerText.includes('반송 중 · 검수 대기')", timeout=20000)
        pc = json.loads(q("select pack_check from orders where id=?", oid)[0][0])
        check(f"{tag} 보내기 전 확인 저장(충전기 못 넣음·초기화·사진)", pc["reset"] is True and [x["ok"] for x in pc["items"]] == [True, False] and len(pc["photos"]) == 1)
        # 5) 판매자 검수: 손상이면 내용·사진 필요
        sp.goto(B + f"/orders/{oid}", wait_until="load")
        check(f"{tag} 판매자 화면: 점검표·받을 때·보낼 때 기록과 사진", sp.locator(".check-compare .stage-check").count() == 3 and sp.locator(".check-compare img").count() == 2)
        ri = api(sc).patch(f"{B}/api/orders/{oid}", data={"action": "INSPECT", "components": {"본체": True}, "condition": "DAMAGED", "note": "모서리 찍힘 생김"})
        check(f"{tag} 검수 API: 손상인데 사진 없으면 400", ri.status == 400 and "사진" in ri.json()["error"])
        sp.get_by_label(re.compile("본체 돌아왔어요")).check(); sp.get_by_role("button", name="새 흠집·손상이 있어요").click()
        check(f"{tag} 검수: 손상 고르면 사진·내용 전엔 버튼 꺼짐", sp.get_by_role("button", name="검수 완료").is_disabled())
        sp.locator(".stage-photo-add input").set_input_files(PHOTO); sp.wait_for_selector(".stage-photo img")
        sp.get_by_label("검수 메모").fill("모서리 찍힘이 새로 생겼어요")
        sp.screenshot(path=f"{OUT}/{tag}_inspect.png", full_page=True)
        sp.get_by_role("button", name="검수 완료").click(); sp.wait_for_function("document.body.innerText.includes('환불 대기')", timeout=20000)
        ins = json.loads(q("select inspection from orders where id=?", oid)[0][0])
        check(f"{tag} 검수 저장(손상·사진)·환불액 그대로", ins["condition"] == "DAMAGED" and len(ins["photos"]) == 1 and q("select refund_amount from orders where id=?", oid)[0][0] == 500000 - 5000)
        check(f"{tag} 검수 결과 채팅 안내(분쟁 안내 포함)", q("select count(*) from chat_messages where body like '%새 흠집·손상%분쟁%'")[0][0] >= 1)
        bp.goto(B + f"/orders/{oid}", wait_until="load")
        check(f"{tag} 구매자도 검수 결과·사진 봄", "새 흠집·손상이 있어요" in bp.locator(".check-compare").inner_text() and bp.locator(".check-compare img").count() == 3)
        bp.locator(".check-compare").screenshot(path=f"{OUT}/{tag}_record.png")
        sc.close(); bc.close(); oc.close()
    check("화면 오류 없음", not errs, errs[:2])
    print(f"{sum(res)}/{len(res)}")
