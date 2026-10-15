# -*- coding: utf-8 -*-
# 거래 전체 시험(격리 3200, 마이그레이션한 복사 DB, 격리 거래 설정). argv[1] 복사 DB, argv[2] 설정 파일, argv[3] 캡처 폴더
import re, sys, json, sqlite3, time
from datetime import datetime, timedelta, timezone
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B = "http://localhost:3200"; DB, SETTINGS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
KEY = next(l.split("=", 1)[1].strip() for l in open(r"E:\PROJECTS\04_써보니\app\.env", encoding="utf-8") if l.startswith("ADMIN_KEY="))
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, d if not ok or d else "", flush=True)
def q(sql, *a):
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; r = c.execute(sql, a).fetchall(); c.commit(); c.close(); return r
def x(sql, *a):
    c = sqlite3.connect(DB); c.execute(sql, a); c.commit(); c.close()
def iso(delta_h): return (datetime.now(timezone.utc) + timedelta(hours=delta_h)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
def sqlts(delta_h): return (datetime.now(timezone.utc) + timedelta(hours=delta_h)).strftime("%Y-%m-%d %H:%M:%S")
def settings(**kw):
    json.dump({"tradeOpen": True, **kw}, open(SETTINGS, "w", encoding="utf-8"))
def overflow(pg):
    pg.add_style_tag(content="nextjs-portal{display:none!important}")
    return pg.evaluate("document.documentElement.scrollWidth > innerWidth")

settings()
with sync_playwright() as p:
    b = p.chromium.launch()
    def ctx(nick, w, h=860):
        c = b.new_context(viewport={"width": w, "height": h}, locale="ko-KR")
        c.add_init_script("try{sessionStorage.setItem('sb_splash','1')}catch(e){}")
        r = c.request.post(B + "/api/session", data={"nickname": nick}); assert r.ok, r.text()
        uid = [ck for ck in c.cookies() if ck["name"] == "sseoboni_sid"][0]["value"].split(".")[0]
        return c, uid
    seller, sellerId = ctx("거래판매자", 1280)
    buyer, buyerId = ctx("거래구매자", 375)
    other, otherId = ctx("구경꾼", 375)
    mid = {m["modelName"]: m["id"] for m in seller.request.get(B + "/api/models").json()["models"]}["MacBook Air M2 13인치"]
    TERMS = {"tiers": [{"hours": 24, "fee": 1000}, {"hours": 48, "fee": 2000}, {"hours": 72, "fee": 3000}], "shippingOneWay": 3000, "conditionNote": ""}
    CHECKS = {"battery": "90% 이상", "screen": "불량 없음", "keys": "모두 정상", "charge": "정상", "look": "흠집 거의 없음", "reset": "보내기 전에 초기화해요"}
    PHOTO = r"E:\PROJECTS\04_써보니\app\public\icons\icon-192.png"
    def upload(ctx_, oid_, stage):
        r_ = ctx_.request.post(f"{B}/api/orders/{oid_}/photos", multipart={"stage": stage, "photo": {"name": "p.png", "mimeType": "image/png", "buffer": open(PHOTO, "rb").read()}}); assert r_.ok, r_.text()
    def listing(title, yes=True, owner=seller, price=100000):
        d = {"modelId": mid, "title": title, "price": price, "conditionGrade": "A", "description": "거래 시험 데이터", "tryWillingness": "YES" if yes else "NO", "components": ["본체", "충전기"], "checkItems": CHECKS}
        if yes: d["trialTerms"] = TERMS
        r = owner.request.post(B + "/api/listings", data=d); assert r.ok, r.text(); return r.json()["listing"]["id"]
    def accept(pg): pg.on("dialog", lambda d: d.accept())

    # 0) 정산 계좌 없으면 신청 불가
    l0 = listing("계좌 없는 맥북")
    bp = buyer.new_page(); accept(bp)
    bp.goto(f"{B}/listings/{l0}", wait_until="networkidle")
    check("계좌 없는 판매자: 신청 대신 의향 버튼", bp.get_by_role("button", name="써보고 싶어요").count() == 1 and bp.get_by_role("button", name="써보기 신청").count() == 0)
    r = buyer.request.post(B + "/api/orders", data={"listingId": l0, "kind": "BUY", "shipTo": {"name": "구매자", "phone": "01012345678", "address": "서울시 강남구 테헤란로 1, 101호"}})
    check("계좌 없으면 신청 API 409", r.status == 409, r.status)

    # 판매자 정산 계좌 등록(화면)
    sp = seller.new_page(); accept(sp)
    sp.goto(f"{B}/me/account", wait_until="networkidle")
    sp.get_by_role("combobox").first.select_option("토스뱅크")
    sp.locator("input[inputmode=numeric]").first.fill("100272632354")
    sp.locator("form input").nth(1).fill("거래판매자")
    sp.get_by_role("button", name="저장하기").click(); sp.wait_for_selector(".form-ok", timeout=20000)
    check("정산 계좌 저장·가린 번호", "1002****2354" in sp.inner_text(".form-ok"), sp.inner_text(".form-ok"))
    enc = q("select account_enc from seller_accounts where user_id=?", sellerId)[0][0]
    check("계좌번호 암호화 저장", enc.startswith("v1.") and "100272632354" not in enc)

    # 1) 써보기 → 반납 전체 흐름(구매자 375 / 판매자 1280)
    l1 = listing("써보기 시험 맥북")
    bp.goto(f"{B}/listings/{l1}", wait_until="networkidle")
    bp.get_by_role("button", name="써보기 신청").click()
    sheet = bp.locator(".order-sheet"); sheet.wait_for()
    sheet.get_by_role("button", name=re.compile("^48시간")).click()
    for qn in ["배터리", "무게"]: sheet.get_by_role("button", name=qn, exact=True).click()
    box = sheet.get_by_label("확인하고 싶은 점 직접 적기"); box.fill("문턱 통과"); box.press("Enter")
    sheet.get_by_role("button", name="키보드", exact=True).click()  # 이미 3개 → 더 안 들어감
    check("체험 전 질문 3개 제한", sheet.locator(".chip[aria-pressed=true]").count() == 3)
    sheet.get_by_label("받는 분 이름").fill("김구매"); sheet.get_by_label("휴대폰 번호").fill("010-2222-3333")
    sheet.get_by_label("주소").fill("서울시 마포구 월드컵로 10, 202호"); sheet.get_by_label("배송 메모").fill("문 앞에 두세요")
    check("신청 시트 금액: 103,000원·환불 98,000원", "103,000원" in sheet.inner_text() and "98,000원" in sheet.inner_text())
    bp.screenshot(path=f"{OUT}/m_order_sheet.png", full_page=True)
    sheet.get_by_role("button", name="써보기 신청하기").click(); bp.wait_for_timeout(500)
    check("동의 안 하면 신청 안 됨", sheet.locator(".form-error").count() == 1)
    sheet.locator(".order-agree input").check()
    sheet.get_by_role("button", name="써보기 신청하기").click()
    bp.wait_for_url(re.compile(r"/orders/[^/]+$"), timeout=30000); bp.wait_for_load_state("networkidle")
    oid = bp.url.rsplit("/", 1)[-1]
    check("신청 → 거래 화면·입금 대기", "입금 대기" in bp.inner_text("h1"))
    body = bp.inner_text("body")
    dep = q("select deposit_name from orders where id=?", oid)[0][0]
    check("구매자에게 계좌 전체 번호·입금자명", "100272632354" in body and dep in body, dep)
    check("계좌 복사 버튼", bp.get_by_role("button", name="계좌번호 복사").count() == 1)
    check("상품 거래 중으로 바뀜", q("select status from listings where id=?", l1)[0][0] == "RESERVED")
    bp.screenshot(path=f"{OUT}/m_order_await.png", full_page=True)
    check("거래 화면 가로 넘침 없음(375)", not overflow(bp))
    op = other.new_page(); op.goto(f"{B}/listings/{l1}", wait_until="networkidle")
    check("다른 사람: 거래 중 표시·신청 버튼 없음", "다른 분과 거래 중" in op.inner_text("body") and op.get_by_role("button", name="써보기 신청").count() == 0)
    check("다른 사람: 거래 화면 접근 불가", other.request.get(f"{B}/api/orders/{oid}").status == 404)
    r = other.request.post(B + "/api/orders", data={"listingId": l1, "kind": "BUY", "shipTo": {"name": "구경꾼", "phone": "01011112222", "address": "서울시 종로구 세종대로 1"}})
    check("거래 중 상품 중복 신청 409", r.status == 409, r.status)
    check("구매자가 판매자 행동 시도 → 409", buyer.request.patch(f"{B}/api/orders/{oid}", data={"action": "CONFIRM_PAYMENT"}).status == 409)

    sp.goto(f"{B}/orders/{oid}", wait_until="networkidle")
    check("판매자: 입금 전 배송지 안 보임", "입금을 확인하면 보여요" in sp.inner_text("body") and "월드컵로" not in sp.inner_text("body"))
    check("판매자: 구매자 등급·기록 표시", "구매 써린이" in sp.inner_text(".buyer-info"))
    sp.get_by_role("button", name="입금 확인했어요").click(); sp.wait_for_function("document.body.innerText.includes('월드컵로')", timeout=20000)
    check("입금 확인 → 배송지 보임", "김구매" in sp.inner_text("body"))
    # 동시 두 번 처리 방지
    r1 = seller.request.patch(f"{B}/api/orders/{oid}", data={"action": "CONFIRM_PAYMENT"})
    check("입금 확인 두 번째는 409", r1.status == 409)
    sp.get_by_role("button", name="발송했어요").click(); sp.wait_for_timeout(400)
    check("택배사 없이 발송 안 됨", q("select status from orders where id=?", oid)[0][0] == "PAID")
    sp.get_by_label("택배사").select_option("CJ대한통운"); sp.get_by_label("송장번호").fill("123456789012")
    sp.get_by_role("button", name="발송했어요").click(); sp.wait_for_function("document.body.innerText.includes('배송 중')", timeout=20000)
    check("발송 → 배송 중", q("select status from orders where id=?", oid)[0][0] == "SHIPPED")

    bp.reload(wait_until="networkidle")
    check("써보기는 받은 상태 사진 없으면 받았어요 못 누름", bp.get_by_role("button", name="받았어요").is_disabled())
    bp.get_by_label(re.compile("본체 왔어요")).check(); bp.get_by_label(re.compile("충전기 왔어요")).check(); bp.get_by_role("button", name="같아요").click()
    bp.locator(".stage-photo-add input").set_input_files(PHOTO); bp.wait_for_selector(".stage-photo img")
    bp.get_by_role("button", name="받았어요").click(); bp.wait_for_function("document.body.innerText.includes('써보는 중')", timeout=20000)
    check("받을 때 확인 저장(구성품·같아요·사진 1장)", '"matches": true' in (q("select arrival_check from orders where id=?", oid)[0][0] or "").replace('":true', '": true') and q("select count(*) from order_photos where order_id=? and stage='RECEIVE'", oid)[0][0] == 1)
    o = q("select * from orders where id=?", oid)[0]
    check("받음 → 써보는 중, 체험 끝 = 받은 때 + 48시간", o["status"] == "TRIAL" and abs((datetime.fromisoformat(o["trial_end_at"].replace("Z", "+00:00")) - datetime.fromisoformat(o["received_at"].replace("Z", "+00:00"))).total_seconds() - 48 * 3600) < 2)
    bp.locator(".order-form", has_text="더 써보기").get_by_role("button", name=re.compile("^72시간")).click()
    bp.get_by_role("button", name="기간 늘리기").click(); bp.wait_for_timeout(1500)
    o = q("select * from orders where id=?", oid)[0]
    check("더 써보기 72시간·체험료 3,000원(추가 입금 없음)", o["trial_hours"] == 72 and o["trial_fee"] == 3000)
    bp.reload(wait_until="networkidle")
    check("지금 돌려보내면 97,000원 표시", "97,000원 환불" in bp.inner_text("body"))
    bp.locator("summary", has_text="돌려보낼게요").click()
    bp.get_by_role("button", name="크기·사이즈가 안 맞아요").click()
    form = bp.locator(".order-return form")
    form.get_by_label("은행").select_option("국민"); form.get_by_label("계좌번호").fill("12345678901234"); form.get_by_label("예금주").fill("김구매")
    form.get_by_role("button", name="반납 신청").click(); bp.wait_for_function("document.body.innerText.includes('반납 신청 · 반송 대기')", timeout=20000)
    o = q("select * from orders where id=?", oid)[0]
    check("반납 신청: 환불 예정 97,000원, 완료 아님", o["status"] == "RETURN_REQUESTED" and o["refund_amount"] == 97000)
    bp.get_by_label("반송 택배사").select_option("우체국택배"); bp.get_by_label("반송 송장번호").fill("6070001112223")
    check("포장 사진·초기화 없으면 반송했어요 못 누름", bp.get_by_role("button", name="반송했어요").is_disabled())
    bp.get_by_label(re.compile("본체 넣었어요")).check(); bp.get_by_label(re.compile("충전기 넣었어요")).check(); bp.get_by_label(re.compile("초기화·계정 로그아웃")).check()
    bp.locator(".stage-photo-add input").set_input_files(PHOTO); bp.wait_for_selector(".stage-photo img")
    bp.get_by_role("button", name="반송했어요").click(); bp.wait_for_function("document.body.innerText.includes('반송 중 · 검수 대기')", timeout=20000)
    check("보내기 전 확인 저장(초기화·사진)", '"reset": true' in (q("select pack_check from orders where id=?", oid)[0][0] or "").replace('":true', '": true'))
    check("반송 → 맡긴 날 기록", q("select return_handover_at from orders where id=?", oid)[0][0] is not None)

    sp.reload(wait_until="networkidle")
    check("판매자 화면에 상태 확인 기록(받을 때·보낼 때 사진)", sp.locator("#check-record-title").count() == 1 and sp.locator(".check-compare img").count() >= 2)
    sp.get_by_label(re.compile("본체 돌아왔어요")).check(); sp.get_by_label(re.compile("충전기 돌아왔어요")).check()
    sp.get_by_role("button", name="보낼 때와 같아요").click()
    sp.get_by_role("button", name="검수 완료").click(); sp.wait_for_function("document.body.innerText.includes('환불 대기')", timeout=20000)
    check("판매자: 검수 뒤 환불 계좌 보임", "12345678901234" in sp.inner_text("body"))
    sp.get_by_role("button", name=re.compile("환불 보냈어요")).click(); sp.wait_for_function("document.body.innerText.includes('환불 보냄')", timeout=20000)
    bp.reload(wait_until="networkidle")
    bp.get_by_role("button", name=re.compile("환불 받았어요")).click(); bp.wait_for_function("document.body.innerText.includes('반납 완료')", timeout=20000)
    check("반납 완료·상품 다시 판매 중", q("select status from orders where id=?", oid)[0][0] == "RETURNED" and q("select status from listings where id=?", l1)[0][0] == "ACTIVE")
    check("경험치: 구매자·판매자 각 1(중복 없음)", q("select count(*) from xp_awards where order_id=?", oid)[0][0] == 2)
    nx = bp.get_by_role("link", name="다른 사이즈 찾아보기")
    check("반납 뒤 다음 검색 제안(누를 때만 이동)", nx.count() == 1 and "/?q=" in (nx.get_attribute("href") or ""))
    check("판매자 화면엔 다음 검색 제안 없음", sp.get_by_role("link", name="다른 사이즈 찾아보기").count() == 0)

    # 후기
    bp.reload(wait_until="networkidle")
    f = bp.locator(".review-form").first
    f.get_by_role("button", name="9점").click(); f.get_by_role("button", name="배송이 빨라요").click()
    f.get_by_role("button", name="같았어요").click(); f.get_by_role("button", name="맞았어요").click()
    f.get_by_role("button", name="쿨거래 감사합니다.").click()
    f.get_by_role("button", name="평가 남기기").click(); bp.wait_for_function("document.body.innerText.includes('내 평가: ★9')", timeout=20000)
    check("구매자 평가 저장·상대 쓰기 전 비공개 안내", "함께 공개" in bp.inner_text("body"))
    t = bp.locator(".review-form").first
    t.get_by_label(re.compile("배터리")).fill("하루 종일 버텼어요"); t.get_by_label("써보고 알게 된 점 한 줄").fill("생각보다 가벼워요")
    t.get_by_role("button", name="써보니 후기 남기기").click(); bp.wait_for_function("document.body.innerText.includes('써보니 후기를 남겼어요')", timeout=20000)
    sp.reload(wait_until="networkidle")
    check("판매자 화면: 상대 평가 있다는 안내(비공개)", "상대가 평가를 남겼어요" in sp.inner_text("body"))
    g = sp.locator(".review-form").first
    g.get_by_role("button", name="10점").click(); g.get_by_role("button", name="반납이 깨끗해요").click()
    g.get_by_role("button", name="평가 남기기").click(); sp.wait_for_function("document.body.innerText.includes('받은 평가: ★9')", timeout=20000)
    check("둘 다 쓰면 서로 공개", True)
    bp.goto(f"{B}/listings/{l1}", wait_until="networkidle")
    check("상품 상세: 이 모델 써본 사람들의 한마디", "생각보다 가벼워요" in bp.inner_text("body") and "체험 거래 인증" in bp.inner_text("body"))
    n_sold = q("select count(*) from orders where status='PURCHASED' and json_extract(snapshot,'$.modelId')=?", mid)[0][0]
    check("상품 상세: 시세(3건 미만이면 비교 거래 부족, 이상이면 중앙값)", ("비교 거래 부족" in bp.inner_text("body")) if n_sold < 3 else ("중앙값" in bp.inner_text("body")), n_sold)
    bp.goto(f"{B}/chats", wait_until="networkidle"); bp.locator(".chat-list__item").first.click(); bp.wait_for_url(re.compile(r"/chats/[^/]+$")); bp.wait_for_load_state("networkidle")
    check("채팅방: 거래 안내 메시지·거래 보기", bp.locator(".chat-system--trade").count() >= 8 and bp.get_by_role("link", name="거래 보기").count() == 1, bp.locator(".chat-system--trade").count())
    bp.screenshot(path=f"{OUT}/m_chat_trade.png", full_page=True)
    r = buyer.request.post(f"{B}/api/chats/{bp.url.rsplit('/',1)[-1]}/report", data={"reason": "기타", "messageId": q("select id from chat_messages where kind='SYSTEM' limit 1")[0][0]})
    check("거래 안내 메시지는 신고 불가", r.status == 404)

    # 2) 바로 구매(구매자 1280 / 판매자 375)
    buyerPC, bpcId = ctx("PC구매자", 1280); sellerM = seller  # 같은 판매자, 화면 폭만 바꿔 확인
    l2 = listing("바로 구매 시험 맥북", yes=False)
    pp = buyerPC.new_page(); accept(pp)
    pp.goto(f"{B}/listings/{l2}", wait_until="networkidle")
    pp.get_by_role("button", name="구매하기").click()
    s2 = pp.locator(".order-sheet"); s2.wait_for()
    check("바로 구매 시트: 기간·질문 없음", s2.get_by_text("써볼 기간").count() == 0)
    s2.get_by_label("받는 분 이름").fill("박피씨"); s2.get_by_label("휴대폰 번호").fill("01099998888"); s2.get_by_label("주소").fill("부산시 해운대구 센텀로 5, 303호")
    s2.locator(".order-agree input").check(); s2.get_by_role("button", name="구매 신청하기").click()
    pp.wait_for_url(re.compile(r"/orders/[^/]+$"), timeout=30000); oid2 = pp.url.rsplit("/", 1)[-1]
    sm = b.new_context(viewport={"width": 375, "height": 860}, storage_state=seller.storage_state()).new_page(); accept(sm)
    sm.goto(f"{B}/orders/{oid2}", wait_until="networkidle")
    sm.get_by_role("button", name="입금 확인했어요").click(); sm.wait_for_function("document.body.innerText.includes('박피씨')", timeout=20000)
    sm.get_by_label("택배사").select_option("한진택배"); sm.get_by_label("송장번호").fill("998877665544"); sm.get_by_role("button", name="발송했어요").click()
    sm.wait_for_function("document.body.innerText.includes('배송 중')", timeout=20000)
    check("판매자 모바일 거래 화면 넘침 없음", not overflow(sm))
    pp.reload(wait_until="networkidle"); pp.get_by_role("button", name="같아요").click(); pp.get_by_role("button", name="받았어요").click(); pp.wait_for_function("document.body.innerText.includes('구매 확정 대기')", timeout=20000)
    pp.get_by_role("button", name="구매 확정").click(); pp.wait_for_function("document.querySelector('h1').innerText.includes('구매 완료')", timeout=20000)
    o2 = q("select * from orders where id=?", oid2)[0]
    check("구매 완료: 상품 판매완료, 수수료 0원(베타)·정식 3% 기록", o2["status"] == "PURCHASED" and q("select status from listings where id=?", l2)[0][0] == "SOLD" and o2["fee_amount"] == 0 and o2["virtual_fee"] == 3000, (o2["fee_amount"], o2["virtual_fee"]))
    pp.screenshot(path=f"{OUT}/pc_order_done.png", full_page=True)
    sp.goto(f"{B}/me/settlement", wait_until="networkidle")
    st = sp.inner_text("body")
    check("정산 내역: 바로 구매 100,000원(기본 발송비 0)·반납 6,000원(체험료+발송비)·정식이었다면 3,000원", "100,000원" in st and "6,000원" in st and "정식이었다면 3,000원" in st, st[:600])
    sp.screenshot(path=f"{OUT}/pc_settlement.png", full_page=True)
    sp.goto(f"{B}/sellers/{sellerId}", wait_until="networkidle")
    sc = sp.inner_text("body")
    check("판매자 채널: 등급·발송 약속 2/2회·후기", "판매 써린이" in sc and "2/2회" in sc, re.findall(r"\d+/\d+회|기록 없음", sc))
    sp.goto(f"{B}/sellers/{sellerId}?tab=reviews", wait_until="networkidle")
    check("판매자 채널 받은 후기 ★9", "★9" in sp.inner_text("body"))
    sp.goto(f"{B}/sellers/{sellerId}?tab=trial", wait_until="networkidle")
    check("판매자 채널 써보니 후기", "생각보다 가벼워요" in sp.inner_text("body"))
    bp.goto(f"{B}/me/reviews", wait_until="networkidle")
    check("내 후기 받은 후기 ★10", "★10" in bp.inner_text("body"))
    for tab in ["sent", "trial"]:
        bp.goto(f"{B}/me/reviews?tab={tab}", wait_until="networkidle")
        check(f"내 후기 {tab} 탭·넘침 없음", bp.locator(".review-list li").count() >= 1 and not overflow(bp))
    bp.goto(f"{B}/me", wait_until="networkidle")
    check("MY: 구매 등급·거래 메뉴", "구매 써린이" in bp.inner_text("body") and bp.get_by_role("link", name=re.compile("내 거래")).count() >= 1)
    bp.goto(f"{B}/orders", wait_until="networkidle")
    check("내 거래 목록: 끝난 거래", "끝난 거래" in bp.inner_text("body") and not overflow(bp))

    # 3) 자동 처리: 입금 기한 → 자동 취소 / 자동 받음 → 써보는 중 → 확인 필요 → 유예 뒤 구매 확정
    ship = {"name": "자동구매", "phone": "01055556666", "address": "대전시 유성구 대학로 99, 1층"}
    l3 = listing("자동 처리 시험 맥북")
    a = buyer.request.post(B + "/api/orders", data={"listingId": l3, "kind": "TRIAL", "hours": 48, "shipTo": ship}).json()["orderId"]
    x("update orders set created_at=? where id=?", sqlts(-49), a)
    bp.goto(f"{B}/orders/{a}", wait_until="networkidle")
    check("입금 기한 지나 자동 취소·상품 판매 중", q("select status from orders where id=?", a)[0][0] == "CANCELLED" and q("select status from listings where id=?", l3)[0][0] == "ACTIVE")
    a = buyer.request.post(B + "/api/orders", data={"listingId": l3, "kind": "TRIAL", "hours": 48, "shipTo": ship}).json()["orderId"]
    seller.request.patch(f"{B}/api/orders/{a}", data={"action": "CONFIRM_PAYMENT"})
    seller.request.patch(f"{B}/api/orders/{a}", data={"action": "SHIP", "carrier": "CJ대한통운", "tracking": "111122223333"})
    x("update orders set shipped_at=? where id=?", iso(-5 * 24 - 1), a)
    bp.goto(f"{B}/orders/{a}", wait_until="networkidle")
    check("발송 5일 지나 자동 받음 → 써보는 중", q("select status from orders where id=?", a)[0][0] == "TRIAL")
    x("update orders set trial_end_at=? where id=?", iso(-1), a)
    bp.goto(f"{B}/orders/{a}", wait_until="networkidle")
    check("체험 끝 → 확인 필요(자동 구매 아님)", q("select status from orders where id=?", a)[0][0] == "NEEDS_CHECK" and "확인 필요" in bp.inner_text("h1"))
    x("update orders set trial_end_at=? where id=?", iso(-73), a)
    bp.goto(f"{B}/orders/{a}", wait_until="networkidle")
    o = q("select * from orders where id=?", a)[0]
    check("유예 72시간 지나 구매 확정(체험료 0원)·자동 기록", o["status"] == "PURCHASED" and o["trial_fee"] == 0 and q("select count(*) from order_events where order_id=? and type='AUTO_PURCHASED'", a)[0][0] == 1)

    # 4) 기간 넘겨 반납 → 다음 구간 체험료
    l4 = listing("초과 반납 시험 맥북")
    a4 = buyer.request.post(B + "/api/orders", data={"listingId": l4, "kind": "TRIAL", "hours": 24, "shipTo": ship}).json()["orderId"]
    seller.request.patch(f"{B}/api/orders/{a4}", data={"action": "CONFIRM_PAYMENT"})
    seller.request.patch(f"{B}/api/orders/{a4}", data={"action": "SHIP", "carrier": "CJ대한통운", "tracking": "444455556666"})
    upload(buyer, a4, "RECEIVE"); buyer.request.patch(f"{B}/api/orders/{a4}", data={"action": "RECEIVED", "components": {"본체": True, "충전기": True}, "matches": True})
    x("update orders set received_at=?, trial_end_at=? where id=?", iso(-30), iso(-6), a4)
    r = buyer.request.patch(f"{B}/api/orders/{a4}", data={"action": "RETURN", "reason": "HEAVY", "refundAccount": {"bank": "신한", "account": "11122233344", "holder": "김구매"}})
    o = q("select * from orders where id=?", a4)[0]
    check("24시간 구간에서 30시간째 반납 → 48시간 체험료 2,000원", r.ok and o["trial_fee"] == 2000 and o["refund_amount"] == 98000, (r.status, o["trial_fee"]))
    upload(buyer, a4, "PACK"); buyer.request.patch(f"{B}/api/orders/{a4}", data={"action": "RETURN_SHIPPED", "reset": True, "packed": {"본체": True, "충전기": True}, "carrier": "우체국택배", "tracking": "7778889990001", "handoverDate": datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d")})

    # 5) 분쟁: 금액 확정 멈춤 → 운영자 정리(환불액 조정) → 재개
    bp.goto(f"{B}/orders/{a4}", wait_until="networkidle")
    bp.get_by_role("button", name="문제가 있어요 (분쟁 신청)").click()
    bp.get_by_role("button", name="하자·고장").click(); bp.get_by_label("분쟁 내용").fill("받을 때부터 키보드 일부가 안 눌렸어요")
    bp.get_by_role("button", name="신청하기").click(); bp.wait_for_function("document.body.innerText.includes('분쟁 확인 중')", timeout=20000)
    check("분쟁 중 판매자 검수 막힘(API 409)", seller.request.patch(f"{B}/api/orders/{a4}", data={"action": "INSPECT", "components": {"본체": True, "충전기": True}}).status == 409)
    sp.goto(f"{B}/orders/{a4}", wait_until="networkidle")
    check("분쟁 중 판매자 화면에 검수 버튼 없음", sp.get_by_role("button", name="검수 완료").count() == 0)
    check("분쟁 중복 신청 409", buyer.request.post(f"{B}/api/orders/{a4}/dispute", data={"reason": "기타", "detail": "한 번 더 신청"}).status == 409)
    adm = b.new_context(viewport={"width": 1280, "height": 900}); adm.add_init_script("try{sessionStorage.setItem('sb_splash','1')}catch(e){}")
    check("운영자 로그인", adm.request.post(B + "/api/admin/session", data={"key": KEY}).ok)
    ap = adm.new_page(); ap.goto(f"{B}/admin", wait_until="networkidle"); ap.wait_for_timeout(2000)
    check("운영자: 거래 열림·분쟁 표시", "거래 · 열림" in ap.inner_text("body") and "받을 때부터 키보드" in ap.inner_text("body"))
    li = ap.locator(".admin-feedback li", has_text="받을 때부터 키보드").first  # 가장 최근 분쟁(이번 시험)
    li.get_by_label("처리 결과").fill("판매자와 확인해 체험료를 받지 않기로 했어요"); li.get_by_label("환불액 조정").fill("100000")
    li.get_by_role("button", name="분쟁 정리").click(); ap.wait_for_timeout(2500)
    check("분쟁 정리·환불액 조정", q("select status from disputes where order_id=?", a4)[0][0] == "RESOLVED" and q("select refund_amount from orders where id=?", a4)[0][0] == 100000)
    check("정리 뒤 검수 가능", seller.request.patch(f"{B}/api/orders/{a4}", data={"action": "INSPECT", "components": {"본체": True, "충전기": False}, "condition": "SAME", "note": "충전기 없음"}).ok)
    ap.screenshot(path=f"{OUT}/pc_admin_trade.png", full_page=True)

    # 6) 입금 뒤 판매자 취소 → 환불 계좌 → 전액 환불 → 취소(경험치 없음)
    l5 = listing("취소 시험 맥북")
    a5 = buyer.request.post(B + "/api/orders", data={"listingId": l5, "kind": "BUY", "shipTo": ship}).json()["orderId"]
    seller.request.patch(f"{B}/api/orders/{a5}", data={"action": "CONFIRM_PAYMENT"})
    seller.request.patch(f"{B}/api/orders/{a5}", data={"action": "CANCEL", "reason": "재고 문제"})
    o = q("select * from orders where id=?", a5)[0]
    check("입금 뒤 취소: 전액 103,000원 환불 대기", o["status"] == "REFUND_DUE" and o["refund_amount"] == 103000)
    check("환불 계좌 없으면 환불 보냄 막힘", seller.request.patch(f"{B}/api/orders/{a5}", data={"action": "REFUND_SENT"}).status == 409)
    bp.goto(f"{B}/orders/{a5}", wait_until="networkidle")
    fr = bp.locator(".order-form", has_text="환불 받을 계좌를 입력해 주세요")
    fr.get_by_label("은행").select_option("하나"); fr.get_by_label("계좌번호").fill("99988877766655"); fr.get_by_label("예금주").fill("김구매")
    fr.get_by_role("button", name="계좌 저장").click(); bp.wait_for_timeout(1500)
    check("환불 보냄 → 받음 → 취소 완료", seller.request.patch(f"{B}/api/orders/{a5}", data={"action": "REFUND_SENT"}).ok and buyer.request.patch(f"{B}/api/orders/{a5}", data={"action": "REFUND_RECEIVED"}).ok and q("select status from orders where id=?", a5)[0][0] == "CANCELLED")
    check("취소는 경험치 없음·상품 판매 중", q("select count(*) from xp_awards where order_id=?", a5)[0][0] == 0 and q("select status from listings where id=?", l5)[0][0] == "ACTIVE")

    # 7) 승인된 제안으로 써보기 신청
    l6 = listing("제안 시험 맥북", yes=False)
    pid = buyer.request.post(B + "/api/proposals", data={"listingId": l6, "hours": 48, "offerFee": 1500, "message": "주말에 써볼게요"}).json()["proposal"]["id"]
    seller.request.patch(f"{B}/api/proposals/{pid}", data={"action": "ACCEPT"})
    bp.goto(f"{B}/listings/{l6}", wait_until="networkidle")
    bp.get_by_role("button", name="제안 조건으로 써보기").click()
    s6 = bp.locator(".order-sheet"); s6.wait_for()
    check("제안 조건 시트: 48시간 1,500원", "1,500원" in s6.inner_text())
    s6.get_by_label("받는 분 이름").fill("김구매"); s6.get_by_label("휴대폰 번호").fill("01022223333"); s6.get_by_label("주소").fill("서울시 마포구 월드컵로 10, 202호")
    s6.locator(".order-agree input").check(); s6.get_by_role("button", name="써보기 신청하기").click()
    bp.wait_for_url(re.compile(r"/orders/[^/]+$"), timeout=30000)
    o = q("select * from orders where id=?", bp.url.rsplit("/", 1)[-1])[0]
    check("제안 조건으로 거래 생성", o["proposal_id"] == pid and o["trial_fee"] == 1500 and o["trial_hours"] == 48)

    # 8) 거래 닫힘
    settings(tradeOpen=False)
    l7 = listing("닫힘 시험 맥북")
    r = buyer.request.post(B + "/api/orders", data={"listingId": l7, "kind": "BUY", "shipTo": ship})
    check("거래 닫히면 신청 403", r.status == 403, r.status)
    bp.goto(f"{B}/listings/{l7}", wait_until="networkidle")
    check("거래 닫히면 의향 버튼·준비 중 문구", bp.get_by_role("button", name="써보고 싶어요").count() == 1 and "준비 중" in bp.inner_text("body"))
    settings()

    # 9) 화면 넘침·캡처
    for path, name in [(f"/orders/{oid}", "m_order_done"), ("/me", "m_me"), ("/me/settlement", "m_settlement"), (f"/sellers/{sellerId}", "m_seller"), ("/me/account", "m_account")]:
        pg = (b.new_context(viewport={"width": 375, "height": 860}, storage_state=(seller if "settlement" in path or "account" in path or "sellers" in path else buyer).storage_state())).new_page()
        pg.add_init_script("try{sessionStorage.setItem('sb_splash','1')}catch(e){}")
        pg.goto(B + path, wait_until="networkidle")
        check(f"375 넘침 없음 {path}", not overflow(pg)); pg.screenshot(path=f"{OUT}/{name}.png", full_page=True)
    print(f"{sum(res)}/{len(res)}")
