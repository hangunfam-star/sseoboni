# -*- coding: utf-8 -*-
# 알림 전체 시험(격리 3200, 복사 DB, 거래 열린 격리 설정, 가짜 푸시 서비스 3298). argv[1] 복사 DB, argv[2] 캡처 폴더, argv[3] pc|m
import sys, sqlite3, time, json, urllib.request
from datetime import datetime, timedelta, timezone
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, F, DB, OUT, TAG = "http://localhost:3200", "http://127.0.0.1:3298", sys.argv[1], sys.argv[2], sys.argv[3]
VP = {"pc": {"width": 1280, "height": 900}, "m": {"width": 375, "height": 812}}[TAG]
ENV = {l.split("=", 1)[0]: l.split("=", 1)[1].strip().strip('"') for l in open(r"E:\PROJECTS\04_써보니\app\.env", encoding="utf-8") if "=" in l and not l.startswith("#")}
AND = "Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36"
IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", f"{TAG} {n}", "" if ok else d, flush=True)
def q(sql, *a):
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; r = c.execute(sql, a).fetchall(); c.commit(); c.close(); return r
def fget(path): return json.loads(urllib.request.urlopen(F + path).read() or b"null")
def wait_for(fn, t=8.0):
    end = time.time() + t
    while time.time() < end:
        v = fn()
        if v: return v
        time.sleep(0.3)
    return fn()
uid = lambda ctx: next((c["value"].split(".")[0] for c in ctx.cookies() if c["name"] == "sseoboni_sid"), None)
notes = lambda u, cat=None: q("select * from notifications where user_id=?" + (" and category=?" if cat else "") + " order by created_at", *([u, cat] if cat else [u]))
SHIP = {"name": "알림시험", "phone": "01055556666", "address": "대전시 유성구 대학로 99, 1층"}
TERMS = {"tiers": [{"hours": 24, "fee": 1000}, {"hours": 48, "fee": 2000}], "shippingOneWay": 3000, "conditionNote": ""}
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    def ctx(nick=None, ua=None, vp=VP, perms=None):
        c = b.new_context(viewport=vp, user_agent=ua) if ua else b.new_context(viewport=vp)
        c.add_init_script("try{sessionStorage.setItem('sb_splash','1')}catch(e){}")
        if perms: c.grant_permissions(perms, origin=B)
        if nick: assert c.request.post(B + "/api/session", data={"nickname": nick}).ok
        return c
    def page(c):
        pg = c.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); return pg
    adm = b.new_context(); assert adm.request.post(B + "/api/admin/session", data={"key": ENV["ADMIN_KEY"]}).ok
    for u in ["/", "/notifications", "/me/notifications", "/me", "/wishlist", "/login", "/manifest.webmanifest", "/api/notifications?count=1", "/api/push"]: adm.request.get(B + u, timeout=120000)  # 개발 서버 첫 컴파일
    for u in ["/api/notifications/prefs", "/api/wishlists", "/api/demand-intents", "/orders/x", "/chats/x", "/listings/x", "/api/orders/x", "/api/seller-account"]: adm.request.get(B + u, timeout=120000)
    for u in ["/api/admin/jobs", "/api/proposals", "/api/push", "/api/notifications", "/api/proposals/x", "/api/orders/x/dispute"]: b.new_context().request.post(B + u, data={}, timeout=120000)
    run_jobs = lambda body=None: adm.request.post(B + "/api/admin/jobs", data=body or {}).json()

    seller, buyer = ctx(f"알림판매{TAG}"), ctx(f"알림구매{TAG}")
    su, bu = uid(seller), uid(buyer)
    seller.request.put(B + "/api/seller-account", data={"bank": "토스뱅크", "account": "100011112222", "holder": "홍길동"})
    models = seller.request.get(B + "/api/models").json()["models"]
    mid = models[0]["id"]; mid2 = models[1]["id"]
    def listing(t, terms=True, model=mid, price=100000):
        d = {"modelId": model, "title": t, "price": price, "conditionGrade": "A", "description": "알림 시험", "tryWillingness": "YES" if terms else "NO", "components": ["본체"]}
        if terms: d["trialTerms"] = TERMS
        return seller.request.post(B + "/api/listings", data=d).json()["listing"]["id"]

    # ── 1) 거래 알림: 신청 → 판매자에게(구매자 본인은 안 받음), 종 배지·알림함·읽음 ──
    l1 = listing(f"알림 아이패드 {TAG}")
    o1 = buyer.request.post(B + "/api/orders", data={"listingId": l1, "kind": "TRIAL", "hours": 24, "shipTo": SHIP}).json()["orderId"]
    sn = notes(su, "TRADE")
    check("신청 → 판매자에게 거래 알림", len(sn) == 1 and sn[0]["url"] == f"/orders/{o1}" and "알림 아이패드" in sn[0]["title"], [dict(x) for x in sn])
    check("한 사람(구매자)은 자기 행동 알림 안 받음", len(notes(bu, "TRADE")) == 0)
    ps = page(seller); ps.goto(B + "/", wait_until="networkidle")
    badge = ps.locator(".top-bell__button .top-chat__badge")
    check("상단 종에 안 읽은 수 1", badge.count() == 1 and badge.inner_text() == "1", badge.count())
    ps.locator(".top-bell__button").click(); ps.wait_for_url("**/notifications", timeout=60000); ps.wait_for_load_state("networkidle")
    check("알림함에 거래 알림(태그·안 읽음 점)", ps.locator(".notification-list li").count() == 1 and "거래" in ps.locator(".notification-tag").first.inner_text() and ps.locator(".notification-dot").count() == 1)
    ps.screenshot(path=f"{OUT}/{TAG}_inbox.png", full_page=True)
    ps.locator(".notification-list a").first.click(); ps.wait_for_url(f"**/orders/{o1}", timeout=60000)
    check("알림 누르면 거래 화면·읽음", q("select read_at from notifications where user_id=? and category='TRADE'", su)[0]["read_at"] is not None)
    # 입금 확인 → 구매자에게
    seller.request.patch(f"{B}/api/orders/{o1}", data={"action": "CONFIRM_PAYMENT"})
    bn = notes(bu, "TRADE")
    check("입금 확인 → 구매자에게 거래 알림", len(bn) == 1 and "입금을 확인" in bn[0]["body"], [x["body"] for x in bn])

    # ── 2) 채팅 알림: 5분 안 여러 개는 하나로, 방 열면 읽음 ──
    tid = q("select id from chat_threads where listing_id=? and buyer_id=?", l1, bu)[0]["id"]
    buyer.request.post(f"{B}/api/chats/{tid}", data={"body": "안녕하세요 첫 메시지"})
    buyer.request.post(f"{B}/api/chats/{tid}", data={"body": "두 번째 메시지예요"})
    cn = notes(su, "CHAT")
    check("채팅 두 개 → 알림 하나·원문 없음", len(cn) == 1 and "두 번째" not in cn[0]["body"] and cn[0]["body"] == f"알림구매{TAG}님이 메시지를 보냈어요." and cn[0]["title"].startswith("새 채팅"), [(x["title"], x["body"]) for x in cn])
    ps.goto(f"{B}/chats/{tid}", wait_until="networkidle")
    check("채팅방 열면 그 채팅 알림 읽음", q("select read_at from notifications where user_id=? and category='CHAT'", su)[0]["read_at"] is not None)

    # ── 3) 알림 설정: 채팅 끄기 → 안 옴, 거래는 잠김, 다시 켜기 ──
    ps.goto(B + "/me", wait_until="networkidle")
    ps.locator("a[href='/me/notifications']").click(); ps.wait_for_url("**/me/notifications", timeout=60000); ps.wait_for_load_state("networkidle")
    sw = ps.get_by_role("switch", name="채팅")
    check("설정 화면: 스위치 4개·거래 잠김", ps.get_by_role("switch").count() == 4 and ps.locator(".notify-switch.is-locked").count() == 1)
    sw.click(); ps.wait_for_timeout(600)
    check("채팅 끄기 저장", q("select chat from notification_prefs where user_id=?", su)[0]["chat"] == 0 and sw.get_attribute("aria-checked") == "false")
    ps.screenshot(path=f"{OUT}/{TAG}_settings.png", full_page=True)
    q("update notifications set read_at='x' where user_id=?", su)
    buyer.request.post(f"{B}/api/chats/{tid}", data={"body": "꺼진 뒤 메시지"})
    check("채팅 끈 뒤엔 채팅 알림 안 생김", len([x for x in notes(su, "CHAT") if x["read_at"] is None]) == 0)
    ps.reload(wait_until="networkidle")
    check("새로고침해도 꺼짐 유지", ps.get_by_role("switch", name="채팅").get_attribute("aria-checked") == "false")
    for name in ["채팅", "관심", "후기", "밤에는 조용히"]:
        s0 = ps.get_by_role("switch", name=name).get_attribute("aria-checked")
        ps.get_by_role("switch", name=name).click(); ps.wait_for_timeout(400)
        s1 = ps.get_by_role("switch", name=name).get_attribute("aria-checked")
        if name != "채팅": ps.get_by_role("switch", name=name).click(); ps.wait_for_timeout(400)
        check(f"스위치 '{name}' 누르면 바뀜", s0 != s1)
    check("설정 원래대로(모두 켬)", dict(q("select chat, interest, review, quiet from notification_prefs where user_id=?", su)[0]) == {"chat": 1, "interest": 1, "review": 1, "quiet": 1})

    # ── 4) 관심 알림: 가격 내림·판매완료·찾던 상품·써보기 제안 ──
    l2 = listing(f"찜 상품 {TAG}", terms=False)
    buyer.request.post(B + "/api/wishlists", data={"listingId": l2})
    seller.request.patch(f"{B}/api/listings/{l2}", data={"price": 90000})
    seller.request.patch(f"{B}/api/listings/{l2}", data={"price": 95000})
    inn = notes(bu, "INTEREST")
    check("찜한 상품 가격 내림 알림(올림은 없음)", len(inn) == 1 and "100,000원 → 90,000원" in inn[0]["body"], [x["body"] for x in inn])
    seller.request.patch(f"{B}/api/listings/{l2}", data={"status": "SOLD"})
    check("찜한 상품 판매완료 알림", any("판매완료" in x["title"] for x in notes(bu, "INTEREST")))
    r = buyer.request.post(B + "/api/demand-intents", data={"modelId": mid2, "intentType": "LOOKING_TO_BUY"})
    listing(f"찾던 모델 {TAG}", terms=False, model=mid2)
    check("찾던 상품 등록 알림", any("찾던 상품" in x["title"] for x in notes(bu, "INTEREST")), r.status)
    l3 = listing(f"제안 상품 {TAG}", terms=False)
    seller.request.patch(f"{B}/api/listings/{l3}", data={"tryWillingness": "CONDITIONAL"})
    pr = buyer.request.post(B + "/api/proposals", data={"listingId": l3, "hours": 24, "offerFee": 3000, "message": "써보고 싶어요"})
    check("써보기 제안 → 판매자 알림", pr.status == 201 and any("써보기 제안" in x["title"] for x in notes(su)), pr.text()[:120])
    if pr.status == 201:
        seller.request.patch(f"{B}/api/proposals/{pr.json()['proposal']['id']}", data={"action": "DECLINE", "reply": "죄송해요"})
        check("제안 거절 → 구매자 알림", any("거절" in x["title"] for x in notes(bu)))

    # ── 5) 정기 작업: 기한 알림(한 번만)·후기 요청·하루 묶음 ──
    l4 = listing(f"기한 상품 {TAG}")
    o4 = buyer.request.post(B + "/api/orders", data={"listingId": l4, "kind": "BUY", "shipTo": SHIP}).json()["orderId"]
    past = (datetime.now(timezone.utc) - timedelta(hours=40)).strftime("%Y-%m-%d %H:%M:%S")
    q("update orders set created_at=? where id=?", past, o4)
    run_jobs(); run_jobs()
    rm = [x for x in notes(bu, "TRADE") if x["dedupe_key"] == f"remind:AWAIT_PAYMENT:{o4}"]
    check("입금 기한 8시간 전 알림 한 번만", len(rm) == 1 and "입금 기한이 8시간" in rm[0]["body"], [x["body"] for x in rm])
    done_at = (datetime.now(timezone.utc) - timedelta(days=4)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    q("update orders set status='PURCHASED', completed_at=? where id=?", done_at, o4)
    run_jobs()
    rv = [x for x in q("select * from notifications where category='REVIEW' and dedupe_key=?", f"review:{o4}")]
    check("거래 끝나고 3일 뒤 후기 요청(양쪽)", {x["user_id"] for x in rv} == {su, bu}, len(rv))
    noon = datetime.now(timezone(timedelta(hours=9))).replace(hour=12, minute=30).isoformat()
    buyer.request.post(B + "/api/wishlists", data={"listingId": l4}) if False else None
    q("insert into market_validation_events (id, event_type, listing_id, user_id) values (?, 'WISHLIST_ADD', ?, ?)", f"t{TAG}{time.time()}", l1, bu)
    run_jobs({"digestAt": noon}); run_jobs({"digestAt": noon})
    dg = [x for x in notes(su, "INTEREST") if (x["dedupe_key"] or "").startswith("digest:")]
    check("하루 묶음: 판매자에게 하루 한 번", len(dg) == 1 and "찜 1" in dg[0]["body"], [x["body"] for x in dg])

    # ── 6) 휴대폰 발송: 암호화·VAPID·거래는 높은 우선순위, 410이면 기기 삭제 ──
    urllib.request.urlopen(F + "/_clear").read()
    k1, k2 = fget("/_keys"), fget("/_keys")
    for k, kind in [(k1, "push"), (k2, "gone")]:
        r = seller.request.post(B + "/api/push", data={"endpoint": f"{F}/{kind}/{k['id']}", "keys": {"p256dh": k["p256dh"], "auth": k["auth"]}})
        assert r.status == 201, r.text()
    buyer.request.post(f"{B}/api/orders/{o1}", data={}) if False else None
    seller.request.patch(f"{B}/api/orders/{o1}", data={"action": "SHIP", "carrier": "CJ대한통운", "tracking": "123456789012"})
    buyer.request.post(f"{B}/api/orders/{o1}/dispute", data={"reason": "기타", "detail": "푸시 시험용 분쟁"})  # 판매자에게 거래 알림
    got = wait_for(lambda: [x for x in fget("/_log") if x["id"] == k1["id"]])
    ok = got and got[0]["text"] and json.loads(got[0]["text"]).get("url") == f"/orders/{o1}"
    check("휴대폰 알림 받음·복호화 내용 일치", ok, got)
    check("aes128gcm·VAPID·거래는 high", got and got[0]["enc"] == "aes128gcm" and got[0]["vapid"] and got[0]["urgency"] == "high", got[:1])
    gone = wait_for(lambda: not q("select 1 from push_subscriptions where endpoint like ?", f"%/gone/{k2['id']}"))
    check("410 받은 기기는 구독 삭제", gone and q("select count(*) n from push_subscriptions where endpoint like ?", f"%/push/{k1['id']}")[0]["n"] == 1)
    check("보낸 알림은 처리 표시", all(x["pushed_at"] for x in q("select pushed_at from notifications where user_id=? and category='TRADE'", su)))

    # ── 7) 이 기기 알림 켜기/끄기(설정 화면, 푸시 구독은 가짜 키로 대신) ──
    k3 = fget("/_keys")
    stub = """(() => { const K = %s; const sub = { endpoint: '%s/push/' + K.id, toJSON() { return { endpoint: this.endpoint, keys: { p256dh: K.p256dh, auth: K.auth } }; }, unsubscribe: async () => { window.__unsub = true; window.__sub = null; return true; } };
      Object.defineProperty(Notification, 'permission', { configurable: true, get: () => window.__perm || 'default' }); Notification.requestPermission = async () => { window.__perm = window.__deny ? 'denied' : 'granted'; return window.__perm; };
      window.__sub = null; PushManager.prototype.subscribe = async function () { window.__sub = sub; return sub; }; PushManager.prototype.getSubscription = async function () { return window.__sub; }; })();""" % (json.dumps(k3), F)
    cs = ctx(perms=["notifications"]); cs.add_cookies(seller.cookies()); cs.add_init_script(stub)
    pg = page(cs); pg.goto(B + "/me/notifications", wait_until="networkidle")
    pg.get_by_role("button", name="알림 켜기").click(); pg.get_by_text("켜짐 · 이 기기로 알림을 받아요").wait_for(timeout=60000)
    check("알림 켜기 → 켜짐·서버 저장", q("select user_id from push_subscriptions where endpoint=?", f"{F}/push/{k3['id']}")[0]["user_id"] == su)
    pg.screenshot(path=f"{OUT}/{TAG}_push_on.png", full_page=True)
    pg.get_by_role("button", name="이 기기 알림 끄기").click(); pg.get_by_role("button", name="알림 켜기").wait_for(timeout=60000)
    check("이 기기 알림 끄기 → 삭제", not q("select 1 from push_subscriptions where endpoint=?", f"{F}/push/{k3['id']}") and pg.evaluate("window.__unsub === true"))
    cd = ctx(); cd.add_cookies(seller.cookies()); cd.add_init_script("window.__deny = true;"); cd.add_init_script(stub)
    pd = page(cd); pd.goto(B + "/me/notifications", wait_until="networkidle")
    pd.get_by_role("button", name="알림 켜기").click(); pd.wait_for_timeout(800)
    check("알림 거절하면 설정 방법 안내", "설정 > 알림" in pd.inner_text("body"))

    # ── 8) 홈 화면 추가 안내 레이어 ──
    mob = {"width": 390, "height": 844}
    ca = ctx(ua=AND, vp=mob); ca.add_cookies(buyer.cookies())
    ca.add_init_script("window.addEventListener('load', () => { window.__sbBip = { prompt: async () => { window.__prompted = true; }, userChoice: Promise.resolve({ outcome: 'accepted' }) }; window.dispatchEvent(new Event('sb-bip')); });")
    pa = page(ca); pa.goto(B + "/", wait_until="networkidle")
    sheet = pa.locator(".install-sheet"); sheet.wait_for(timeout=30000)
    check("안드로이드: 3초 뒤 설치 레이어·추가 버튼", "홈 화면에 추가할까요" in sheet.inner_text() and pa.get_by_role("button", name="홈 화면에 추가").count() == 1)
    pa.screenshot(path=f"{OUT}/install_android.png")
    pa.get_by_role("button", name="홈 화면에 추가").click(); pa.wait_for_timeout(500)
    check("추가 버튼 → 설치 창 열기·레이어 닫힘", pa.evaluate("window.__prompted === true") and sheet.count() == 0)
    pa.reload(wait_until="networkidle"); pa.wait_for_timeout(4500)
    check("설치 후엔 다시 안 뜸", pa.locator(".install-sheet").count() == 0)

    ci = ctx(ua=IOS, vp=mob); pi = page(ci); pi.goto(B + "/", wait_until="networkidle")
    pi.locator(".install-sheet").wait_for(timeout=30000)
    check("아이폰: 3단계 안내·공유 버튼 화살표", pi.locator(".install-steps li").count() == 3 and pi.locator(".install-sheet__arrow").count() == 1)
    pi.screenshot(path=f"{OUT}/install_ios.png")
    pi.get_by_role("button", name="다음에 할게요").click(); pi.wait_for_timeout(300)
    memo = pi.evaluate("JSON.parse(localStorage.getItem('sb_install'))")
    check("다음에 → 닫힘·7일", pi.locator(".install-sheet").count() == 0 and 6.9 < (memo["until"] / 1000 - time.time()) / 86400 < 7.1, memo)
    pi.reload(wait_until="networkidle"); pi.wait_for_timeout(4500)
    check("닫은 뒤 새로고침해도 안 뜸", pi.locator(".install-sheet").count() == 0)
    pi.evaluate("localStorage.setItem('sb_install', JSON.stringify({until: 0, dismissed: 2, forced: true}))")
    pi.reload(wait_until="networkidle"); pi.locator(".install-sheet").wait_for(timeout=30000)
    pi.keyboard.press("Escape"); pi.wait_for_timeout(300)
    memo = pi.evaluate("JSON.parse(localStorage.getItem('sb_install'))")
    check("세 번째 닫기(Esc)는 30일", pi.locator(".install-sheet").count() == 0 and 29.9 < (memo["until"] / 1000 - time.time()) / 86400 < 30.1, memo)

    ck = ctx(ua=IOS + " KAKAOTALK 10.8.0", vp=mob); pk = page(ck); pk.goto(B + "/", wait_until="networkidle")
    pk.locator(".install-sheet").wait_for(timeout=30000)
    check("카카오톡 안: 기본 브라우저로 열기 버튼", pk.get_by_role("button", name="기본 브라우저로 열기").count() == 1)
    pk.screenshot(path=f"{OUT}/install_kakao.png")
    nav = []
    pk.on("request", lambda r: nav.append(r.url))
    try: pk.get_by_role("button", name="기본 브라우저로 열기").click(timeout=3000)
    except Exception: pass
    pk.wait_for_timeout(500)
    check("기본 브라우저로 열기 → 카카오톡 외부 열기 주소", any(u.startswith("kakaotalk://web/openExternal?url=") for u in nav) or pk.evaluate("location.href").startswith(B), nav[-1:])
    pk.goto(B + "/", wait_until="networkidle"); pk.locator(".install-layer").wait_for(timeout=30000)
    pk.mouse.click(10, 10); pk.wait_for_timeout(300)
    check("바깥(어두운 곳) 누르면 닫힘", pk.locator(".install-sheet").count() == 0)

    cx = ctx(ua=AND, vp=mob); px = page(cx); px.goto(f"{B}/listings/{l1}", wait_until="networkidle"); px.wait_for_timeout(5000)
    check("상품 상세에서는 안 뜸", px.locator(".install-sheet").count() == 0)
    cpc = ctx(); ppc = page(cpc); ppc.goto(B + "/", wait_until="networkidle"); ppc.wait_for_timeout(5000)
    check("PC에서는 안 뜸", ppc.locator(".install-sheet").count() == 0)
    # 거래 알림이 생기면 7일 규칙과 상관없이 한 번 더
    cf = ctx(ua=AND, vp=mob); cf.add_cookies(seller.cookies()); pf = page(cf)
    pf.goto(B + "/", wait_until="domcontentloaded"); pf.evaluate("localStorage.setItem('sb_install', JSON.stringify({until: Date.now() + 5*86400000, dismissed: 1, forced: false}))")
    q("update notifications set read_at=null where id=(select id from notifications where user_id=? and category='TRADE' order by created_at desc limit 1)", su)
    pf.reload(wait_until="networkidle"); pf.locator(".install-sheet").wait_for(timeout=30000)
    pf.get_by_role("button", name="다음에 할게요").click(); pf.reload(wait_until="networkidle"); pf.wait_for_timeout(5000)
    check("거래 알림 있으면 한 번 더 → 그 뒤엔 안 뜸", pf.locator(".install-sheet").count() == 0 and pf.evaluate("JSON.parse(localStorage.getItem('sb_install')).forced") is True)
    # 홈 화면에서 처음 열면 알림 허용 안내
    k4 = fget("/_keys")
    cn = ctx(ua=AND, vp=mob, perms=["notifications"]); cn.add_cookies(buyer.cookies())
    cn.add_init_script("""(() => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => q === '(display-mode: standalone)' ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q);
       })();""")
    cn.add_init_script(stub.replace(json.dumps(k3), json.dumps(k4)))
    pn = page(cn); pn.goto(B + "/?from=home-screen", wait_until="networkidle")
    pn.locator(".install-sheet").wait_for(timeout=30000)
    check("홈 화면에서 처음 열면 알림 켜기 안내", "알림을 켜 둘까요" in pn.locator(".install-sheet").inner_text())
    pn.screenshot(path=f"{OUT}/notify_prompt.png")
    pn.get_by_role("button", name="알림 켜기").click(); pn.wait_for_timeout(1500)
    check("안내에서 알림 켜기 → 구독 저장·닫힘", q("select user_id from push_subscriptions where endpoint=?", f"{F}/push/{k4['id']}")[0]["user_id"] == bu and pn.locator(".install-sheet").count() == 0)

    # ── 9) 홈 화면 앱 설정·아이콘·서비스 워커 ──
    man = cpc.request.get(B + "/manifest.webmanifest")
    mj = man.json() if man.ok else {}
    check("앱 설정(manifest): 이름·전체화면·아이콘", mj.get("short_name") == "써보니" and mj.get("display") == "standalone" and len(mj.get("icons", [])) == 3)
    check("아이콘·서비스 워커 파일", all(cpc.request.get(B + u).status == 200 for u in ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-96.png", "/sw.js", "/apple-icon.png", "/icon.png"]))
    # 모두 읽음
    pb = page(buyer); pb.goto(B + "/notifications", wait_until="networkidle")
    n_before = pb.locator(".notification-dot").count()
    pb.get_by_role("button", name="모두 읽음").click(); pb.wait_for_timeout(800)
    check("모두 읽음 버튼", n_before > 0 and pb.locator(".notification-dot").count() == 0 and q("select count(*) n from notifications where user_id=? and read_at is null", bu)[0]["n"] == 0, n_before)
    check("화면 오류 없음", not errs, errs[:3])
    print(f"{TAG} {sum(res)}/{len(res)}")
