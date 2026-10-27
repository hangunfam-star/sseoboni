# -*- coding: utf-8 -*-
# 탈퇴 1단계(2026-10-26, docs/review/WITHDRAW_PLAN_v7.md) 시험. 격리 3200 + 가짜 카카오 3299.
# 서버: WITHDRAW=1 bash ops/e2e/run_isolated.sh   (오류 주입 시험은 WITHDRAW_FAULT=after_p6 도 함께 → 모드 fault)
# 사용: python ops/e2e/suites/test_withdraw.py <복사 DB> <캡처 폴더> <pc|m|fault>
# 점검마다 "탈퇴 전에는 반대 결과"를 먼저 확인해, 점검이 실제로 실패를 잡는지 함께 본다(84절).
import sys, sqlite3, urllib.request, urllib.parse, urllib.error, time, json, os, secrets, threading, base64
from datetime import datetime, timezone, timedelta
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, F, DB, OUT, MODE = "http://localhost:3200", "http://localhost:3299", sys.argv[1], sys.argv[2], sys.argv[3]
ENV = {l.split("=", 1)[0]: l.split("=", 1)[1].strip().strip('"') for l in open(os.path.join(os.path.dirname(__file__), "..", "..", "..", "app", ".env"), encoding="utf-8") if "=" in l and not l.startswith("#")}
IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
def fake(**kw): urllib.request.urlopen(F + "/_set?" + urllib.parse.urlencode(kw)).read()
def q(sql, *a):
    c = sqlite3.connect(DB); r = c.execute(sql, a).fetchall(); c.close(); return r
def x(sql, *a):
    c = sqlite3.connect(DB); c.execute(sql, a); c.commit(); c.close()
def ago(hours): return (datetime.now(timezone.utc) - timedelta(hours=hours)).strftime("%Y-%m-%d %H:%M:%S")
KID = int(time.time()) % 100000 + 800000 + (0 if MODE == "pc" else 300 if MODE == "m" else 600)
TAG = MODE
VP = {"viewport": {"width": 1280, "height": 900}} if MODE != "m" else {"viewport": {"width": 375, "height": 812}, "is_mobile": True, "has_touch": True, "user_agent": IPHONE}
MODEL = q("select id from product_models where model_name like 'MacBook Air M2%'")[0][0]
DEL = ["social_accounts", "login_links", "seller_accounts", "wishlists", "demand_intents", "notifications", "push_subscriptions", "notification_prefs"]

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    # 개발 서버는 처음 여는 화면·API를 그 자리에서 만들므로(느림) 시험 전에 한 번씩 열어 둔다
    warm = b.new_context()
    for u in ["/withdrawn", "/me/account", "/sellers/x?tab=reviews", "/notifications", "/chats/x", "/api/me/withdraw", "/api/session"]: warm.request.get(B + u, timeout=180000)
    for u in ["/api/chats/x", "/api/chats", "/api/me/withdraw", "/api/proposals", "/api/proposals/x", "/api/orders/x/review", "/api/wishlists", "/api/demand-intents"]: warm.request.post(B + u, data={}, timeout=180000)
    warm.close()
    def login(kid, nick):
        # 느린 개발 서버에서 한 번 멈추는 경우가 있어 1번 다시 시도한다
        try: return login_once(kid, nick)
        except Exception: return login_once(kid, nick)
    def login_once(kid, nick):
        c = b.new_context(**VP); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
        pg = c.new_page(); pg.set_default_timeout(60000); pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
        fake(id=kid, nick=nick)
        pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click()
        pg.wait_for_url(lambda u: "step=kakao" in u or u.rstrip("/") == B)  # 이미 가입한 카카오면 닉네임 화면 없이 바로 들어온다
        if "step=kakao" in pg.url:
            pg.get_by_role("button", name="카카오 닉네임으로 시작하기").click(); pg.wait_for_url(B + "/")
        uid = next(k["value"].split(".")[0] for k in c.cookies() if k["name"] == "sseoboni_sid")
        return c, pg, uid
    def listing(c, title):
        d = {"modelId": MODEL, "title": title, "price": 300000, "conditionGrade": "A", "description": "탈퇴 시험", "tryWillingness": "NO", "components": ["본체"], "trialTerms": None}
        return c.request.post(B + "/api/listings", data=d).json()["listing"]["id"]
    def insert_order(lid, buyer, seller, status, completed=None, proposal=None):
        oid = "wd_" + secrets.token_hex(8)
        x("insert into orders (id, listing_id, buyer_id, seller_id, kind, status, snapshot, price, deposit_name, ship_enc, proposal_id, completed_at) values (?,?,?,?,?,?,?,?,?,?,?,?)",
          oid, lid, buyer, seller, "BUY", status, json.dumps({"title": f"시험 거래 {status}"}), 300000, "시험1234", "", proposal, completed)
        return oid
    def insert_prop(lid, buyer, status, message=None, reply=None):
        pid = "wdp_" + secrets.token_hex(6)
        x("insert into trial_proposals (id, listing_id, buyer_id, hours, offer_fee, message, status, seller_reply) values (?,?,?,?,?,?,?,?)", pid, lid, buyer, 24, 1000, message, status, reply)
        return pid
    def give_data(c, uid, other_lid):
        # 삭제 대상 8개 표에 줄 만들기(로그인으로 social_accounts는 이미 있음)
        c.request.put(B + "/api/seller-account", data={"bank": "국민", "account": "12345678901234", "holder": "시험", "defaultShipping": 3000})
        c.request.post(B + "/api/wishlists", data={"listingId": other_lid})
        c.request.post(B + "/api/demand-intents", data={"modelId": MODEL, "intentType": "WANT_TO_TRY"})
        c.request.put(B + "/api/notifications/prefs", data={"chat": True, "interest": False})
        # 가짜 푸시 서비스(3298, run_isolated.sh가 띄움)로 가는 구독. 키는 형식만 맞는 시험 값
        p256 = base64.urlsafe_b64encode(b"\x04" + secrets.token_bytes(64)).decode().rstrip("="); au = base64.urlsafe_b64encode(secrets.token_bytes(16)).decode().rstrip("=")
        x("insert into push_subscriptions (endpoint, user_id, p256dh, auth) values (?,?,?,?)", f"http://127.0.0.1:3298/push/{uid}", uid, p256, au)
        ac = b.new_context(); ac.request.post(B + "/api/admin/session", data={"key": ENV["ADMIN_KEY"]}); ac.request.post(B + "/api/admin/login-link", data={"userId": uid}); ac.close()
    def per_user(uid): return {t: q(f"select count(*) from {t} where user_id=?", uid)[0][0] for t in DEL}
    def open_withdraw(pg):
        # 화면이 준비(하이드레이션)되기 전에 누르면 반응이 없어 확인 칸이 보일 때까지 다시 누른다
        pg.wait_for_load_state("networkidle")
        for _ in range(5):
            pg.get_by_role("button", name="탈퇴 안내 보기").click()
            try: pg.get_by_placeholder("여기에 직접 입력").wait_for(timeout=8000); return
            except Exception: pass
        raise AssertionError("탈퇴 안내가 열리지 않음")
    W_NICK = f"탈퇴{TAG}{KID % 1000}"

    if MODE == "fault":
        # T13 오류 주입: 서버가 WITHDRAW_FAULT=after_p6 로 떠 있어야 한다
        wc, wp, wid = login(KID, W_NICK)
        oc, _, oid_ = login(KID + 1, f"상대f{KID % 1000}")
        sc, _, s3 = login(KID + 2, f"판매f{KID % 1000}")
        lid = listing(wc, "오류 주입 상품"); other = listing(sc, "오류 주입 다른 상품")
        give_data(wc, wid, other)
        th = oc.request.post(B + "/api/chats", data={"listingId": lid}).json()["threadId"]
        oc.request.post(f"{B}/api/chats/{th}", data={"body": "안녕하세요"}); wc.request.post(f"{B}/api/chats/{th}", data={"body": "네 안녕하세요"})
        oc.request.post(B + "/api/proposals", data={"listingId": lid, "hours": 24, "offerFee": 1000, "message": "써보고 싶어요"})
        overdue = insert_order(lid, oid_, wid, "CANCELLED", completed=ago(2))
        x("update orders set created_at=? where id=?", ago(200), overdue)
        tables = ["users", "listings", "trial_proposals", "notifications", "market_validation_events", "orders", "order_events", "chat_messages"] + DEL
        def snap():
            s = {t: q(f"select count(*) from {t}")[0][0] for t in tables}
            s["mine"] = per_user(wid)
            s["me"] = q("select status, nickname, kakao_image_url, withdrawn_at from users where id=?", wid)[0]
            s["listing"] = q("select status from listings where id=?", lid)[0]
            s["props"] = q("select id, status, message, seller_reply from trial_proposals where listing_id=? order by id", lid)
            s["note_bodies"] = q("select group_concat(user_id || ':' || body, '|') from (select user_id, body from notifications order by id)")[0]
            s["events"] = q("select group_concat(id || ':' || coalesce(user_id,''), '|') from (select id, user_id from market_validation_events order by id)")[0]
            return s
        before = snap()
        check("T13 준비: 탈퇴자 8개 표 줄 모두 있음, 상대 알림에 닉네임", all(v >= 1 for v in before["mine"].values()) and q("select count(*) from notifications where user_id=? and body=?", oid_, f"{W_NICK}님이 메시지를 보냈어요.")[0][0] == 1, before["mine"])
        r = wc.request.post(B + "/api/me/withdraw", data={"confirm": "탈퇴합니다"})
        after = snap()
        check("T13 오류 주입: 500 응답", r.status == 500, r.status)
        check("T13 오류 주입: 표 전체 수·8개 표 탈퇴자 줄·사용자·상품·제안·알림 본문·통계 id 모두 그대로", before == after, [k for k in before if before[k] != after[k]])
        check("T13 오류 주입 뒤 아직 로그인 상태", wc.request.get(B + "/api/session").json().get("user") is not None)
        print(f"== {sum(res)}/{len(res)} 통과, 실패 {len(res) - sum(res)}"); b.close(); sys.exit(0 if all(res) else 1)

    # ── 사람 준비 ──
    wc, wp, wid = login(KID, W_NICK)                 # 탈퇴할 사람(판매자 겸 구매자)
    oc, op, oid_ = login(KID + 1, f"상대{TAG}{KID % 1000}")      # 탈퇴자와 채팅·거래한 상대
    t1c, _, t1 = login(KID + 2, W_NICK)              # 탈퇴자와 같은 닉네임의 다른 사람(T7)
    t2c, _, t2 = login(KID + 3, f"제삼{TAG}{KID % 1000}")       # 같은 닉네임 사람과 채팅하는 사람
    sc, _, s3 = login(KID + 4, f"다른판매{TAG}{KID % 1000}")    # 다른 판매자(같은 답글로 거절)
    b3c, _, b3 = login(KID + 5, f"다른구매{TAG}{KID % 1000}")   # 다른 판매자에게 제안한 사람
    sc.request.put(B + "/api/seller-account", data={"bank": "국민", "account": "12345678901234", "holder": "시험", "defaultShipping": 3000})

    # 탈퇴자 상품 4상태 + 내 데이터
    L = {k: listing(wc, f"탈퇴 시험 {k} {TAG}") for k in ["ACTIVE", "HIDDEN", "RESERVED", "SOLD", "PROP1", "PROP2", "USED", "OLD"]}
    x("update listings set status='HIDDEN' where id=?", L["HIDDEN"]); x("update listings set status='RESERVED' where id=?", L["RESERVED"]); x("update listings set status='SOLD' where id=?", L["SOLD"])
    other_lid = listing(sc, f"다른 판매자 상품 {TAG}")
    o_lid = listing(oc, f"상대 판매 상품 {TAG}")
    t1_lid = listing(t1c, f"같은 닉네임 상품 {TAG}")
    give_data(wc, wid, other_lid)

    # 채팅: 상대 → 탈퇴자 상품, 탈퇴자 → 상대에게(알림 본문에 탈퇴자 닉네임)
    th = oc.request.post(B + "/api/chats", data={"listingId": L["ACTIVE"]}).json()["threadId"]
    oc.request.post(f"{B}/api/chats/{th}", data={"body": "안녕하세요, 아직 판매하시나요?"})
    wc.request.post(f"{B}/api/chats/{th}", data={"body": "네 판매 중이에요."})
    th2 = t2c.request.post(B + "/api/chats", data={"listingId": t1_lid}).json()["threadId"]
    t1c.request.post(f"{B}/api/chats/{th2}", data={"body": "네 안녕하세요"})
    # 제안
    REPLY = f"죄송해요 지금은 어려워요 {TAG}"
    p_pending = oc.request.post(B + "/api/proposals", data={"listingId": L["PROP1"], "hours": 24, "offerFee": 1000, "message": "써보고 싶어요"}).json()["proposal"]["id"]
    p_declined = b3c.request.post(B + "/api/proposals", data={"listingId": L["PROP2"], "hours": 24, "offerFee": 1000, "message": "부탁드려요"}).json()["proposal"]["id"]
    wc.request.patch(f"{B}/api/proposals/{p_declined}", data={"action": "DECLINE", "reply": REPLY})
    p_other = b3c.request.post(B + "/api/proposals", data={"listingId": other_lid, "hours": 24, "offerFee": 1000, "message": "부탁드려요"}).json()["proposal"]["id"]
    sc.request.patch(f"{B}/api/proposals/{p_other}", data={"action": "DECLINE", "reply": REPLY})
    p_mine = wc.request.post(B + "/api/proposals", data={"listingId": other_lid, "hours": 24, "offerFee": 2000, "message": "제가 써볼게요"}).json()["proposal"]["id"]
    p_used = insert_prop(L["USED"], oid_, "ACCEPTED", "승인된 제안", "좋아요")
    p_free = insert_prop(L["PROP1"], oid_, "ACCEPTED", "승인된 제안", "좋아요")
    # CANCELLED·EXPIRED 양쪽(탈퇴자가 구매자 / 탈퇴자 상품)
    p_mc = insert_prop(other_lid, wid, "CANCELLED", "취소된 내 제안", None); p_me = insert_prop(other_lid, wid, "EXPIRED", "만료된 내 제안", None)
    p_lc = insert_prop(L["PROP2"], oid_, "CANCELLED", "취소", "취소 답글"); p_le = insert_prop(L["PROP2"], oid_, "EXPIRED", "만료", "만료 답글")
    insert_order(L["USED"], oid_, wid, "PURCHASED", completed=ago(200), proposal=p_used)
    # 후기: 탈퇴자가 상대 상품을 사고 쓴 후기(상대 판매자 채널에 탈퇴자 닉네임이 보임) — 300시간 전 완료라 막지 않음
    # 후기는 공개 기간이 지나야 채널에 보이므로 30일 전 거래·후기로 만든다
    o_order = insert_order(o_lid, wid, oid_, "PURCHASED", completed=ago(800))
    x("insert into reviews (id, order_id, writer_id, target_id, direction, stars, chips, body, created_at) values (?,?,?,?,?,?,?,?,?)", "wdr_" + secrets.token_hex(6), o_order, wid, oid_, "B2S", 9, json.dumps(["친절해요"]), "좋은 거래였어요", ago(720))
    # 9일 전 끝난 거래(상대가 구매자, 탈퇴자가 판매자) — 탈퇴 뒤 상대가 후기를 쓸 수 있어야 함
    day9 = insert_order(L["OLD"], oid_, wid, "PURCHASED", completed=ago(216))

    # ── T2 막는 조건(별도 사용자 X의 주문 상태를 바꿔 가며 GET으로 확인. 정확한 168시간 경계는 withdraw_unit.ts) ──
    xc, _, xid = login(KID + 6, f"막힘{TAG}{KID % 1000}")
    xl = listing(sc, f"막힘 시험 {TAG}")
    def blockers(): return [bb["reason"] for bb in xc.request.get(B + "/api/me/withdraw").json().get("blockers", [])]
    ox = insert_order(xl, xid, s3, "PAID")
    check(f"{TAG} T2 진행 중(PAID) 막힘", blockers() == ["진행 중"], blockers())
    x("update orders set status='PURCHASED', completed_at=? where id=?", ago(168 - 5 / 3600), ox)
    check(f"{TAG} T2 완료 168시간-5초 막힘", blockers() == ["분쟁 가능 기간"], blockers())
    x("update orders set completed_at=? where id=?", ago(168 + 5 / 3600), ox)
    check(f"{TAG} T2 완료 168시간+5초 통과", blockers() == [], blockers())
    x("update orders set completed_at=NULL where id=?", ox)
    check(f"{TAG} T2 completed_at 없음 막힘", blockers() == ["분쟁 가능 기간"], blockers())
    x("update orders set status='CANCELLED', completed_at=? where id=?", ago(1), ox)
    check(f"{TAG} T2 취소 1시간 전 통과", blockers() == [], blockers())
    x("update orders set status='PURCHASED', completed_at=? where id=?", ago(300), ox)
    x("insert into disputes (id, order_id, opener_id, reason, detail, status) values (?,?,?,?,?,?)", "wdd_" + secrets.token_hex(6), ox, s3, "기타", "시험 분쟁", "OPEN")
    check(f"{TAG} T2 OPEN 분쟁 막힘", blockers() == ["분쟁 중"], blockers())
    r409 = xc.request.post(B + "/api/me/withdraw", data={"confirm": "탈퇴합니다"})
    check(f"{TAG} T2 막히면 409이고 아무것도 안 바뀜", r409.status == 409 and q("select status from users where id=?", xid)[0][0] == "ACTIVE", r409.status)

    # ── T9 틀린 입력 ──
    check(f"{TAG} T9 빈 입력 400", wc.request.post(B + "/api/me/withdraw", data={"confirm": ""}).status == 400)
    check(f"{TAG} T9 공백만 입력 400", wc.request.post(B + "/api/me/withdraw", data={"confirm": "   "}).status == 400)
    check(f"{TAG} T9 501자 입력 400", wc.request.post(B + "/api/me/withdraw", data={"confirm": "가" * 501}).status == 400)
    zc, _, zid = login(KID + 7, f"남의id{TAG}{KID % 1000}")
    rz = zc.request.post(B + "/api/me/withdraw", data={"confirm": "탈퇴합니다", "userId": wid})
    check(f"{TAG} T9 맞는 확인 문구 + 남의 id → 요청한 본인만 탈퇴, 남(탈퇴 예정자)은 그대로", rz.status == 200 and q("select status from users where id=?", zid)[0][0] == "WITHDRAWN" and q("select status from users where id=?", wid)[0][0] == "ACTIVE", rz.status)
    fake(id=KID + 60, nick="탈퇴한 사용자")
    nc = b.new_context(**VP); npg = nc.new_page()
    npg.goto(B + "/login", wait_until="load"); npg.get_by_role("link", name="카카오로 로그인").click(); npg.wait_for_url("**/login?step=kakao**"); npg.wait_for_timeout(1500)
    check(f"{TAG} T9 카카오 닉네임 '탈퇴한 사용자'로는 '카카오 닉네임으로 시작하기' 버튼이 없음", npg.get_by_role("button", name="카카오 닉네임으로 시작하기").count() == 0 and q("select count(*) from users where nickname='탈퇴한 사용자' and status='ACTIVE'")[0][0] == 0)
    npg.screenshot(path=f"{OUT}/withdraw_{TAG}_reserved_nick.png", full_page=True); nc.close()

    # ── T5 동시 탈퇴 2개(별도 사용자 Y, 같은 쿠키로 동시에 POST) ──
    yc, _, yid = login(KID + 8, f"동시{TAG}{KID % 1000}")
    cookie = "; ".join(f"{k['name']}={k['value']}" for k in yc.cookies())
    out5 = []
    def hit():
        rq = urllib.request.Request(B + "/api/me/withdraw", data=json.dumps({"confirm": "탈퇴합니다"}).encode(), headers={"Content-Type": "application/json", "Cookie": cookie}, method="POST")
        try:
            with urllib.request.urlopen(rq, timeout=60) as r: out5.append((r.status, json.loads(r.read() or b"{}")))
        except urllib.error.HTTPError as e: out5.append((e.code, {}))
    ths = [threading.Thread(target=hit) for _ in range(2)]; [t.start() for t in ths]; [t.join() for t in ths]
    already = sum(1 for s, j in out5 if s == 200 and j.get("already")); ok = sum(1 for s, j in out5 if s == 200 and not j.get("already"))
    check(f"{TAG} T5 동시 2개 → 한 건만 탈퇴 처리, 다른 건은 already(둘 다 200)", ok == 1 and already == 1 and q("select count(*) from users where id=? and status='WITHDRAWN' and withdrawn_at is not null", yid)[0][0] == 1, out5)

    # ── 탈퇴 전 상태(반대 결과 먼저 확인) ──
    pre = per_user(wid)
    others_pre = {t: q(f"select count(*) from {t} where user_id<>?", wid)[0][0] for t in DEL}
    check(f"{TAG} 탈퇴 전: 삭제 대상 8개 표에 탈퇴자 줄이 모두 있음", all(v >= 1 for v in pre.values()), pre)
    check(f"{TAG} 탈퇴 전: 상대 알림에 탈퇴자 닉네임 있음", q("select count(*) from notifications where user_id=? and url=? and body=?", oid_, f"/chats/{th}", f"{W_NICK}님이 메시지를 보냈어요.")[0][0] == 1)
    twin_before = q("select id, body from notifications where user_id=? and url=?", t2, f"/chats/{th2}")
    check(f"{TAG} 탈퇴 전: 같은 닉네임 다른 사람의 알림 있음", len(twin_before) == 1 and twin_before[0][1] == f"{W_NICK}님이 메시지를 보냈어요.", twin_before)
    other_decl_before = q("select id, body from notifications where user_id=? and url=?", b3, f"/listings/{other_lid}")
    check(f"{TAG} 탈퇴 전: 거절 알림 2개에 같은 답글", q("select count(*) from notifications where user_id=? and url=? and body like ?", b3, f"/listings/{L['PROP2']}", f"%{REPLY}%")[0][0] == 1 and any(REPLY in d[1] for d in other_decl_before))
    op.goto(B + f"/sellers/{oid_}?tab=reviews", wait_until="load"); op.wait_for_timeout(800)
    check(f"{TAG} 탈퇴 전: 상대 판매자 채널 후기에 탈퇴자 닉네임 보임", W_NICK in op.inner_text("body"))
    ev_ids = [r[0] for r in q("select id from market_validation_events where user_id=?", wid)]
    ev_others = q("select id, user_id from market_validation_events where user_id is not ? order by id", wid)

    # ── 내 정보 화면의 탈퇴 입구 ──
    wp.goto(B + "/me", wait_until="load")
    check(f"{TAG} 내 정보 화면에 탈퇴 입구(정산 계좌 화면 탈퇴 칸으로 연결)", wp.locator('a[href="/me/account#withdraw-title"]').count() == 1)
    # ── T11 화면: 세션이 끊긴 뒤 누르면 완료로 보이지 않음 → 다시 로그인 → 앞뒤 공백이면 버튼 꺼짐 → 정상 탈퇴 ──
    wp.goto(B + "/me/account", wait_until="load")
    open_withdraw(wp)
    check(f"{TAG} T11 확인 문구 전에는 탈퇴 버튼 꺼짐", wp.get_by_role("button", name="탈퇴하기").is_disabled())
    wp.get_by_placeholder("여기에 직접 입력").fill("   ")
    check(f"{TAG} T11 공백만 넣으면 버튼 꺼짐", wp.get_by_role("button", name="탈퇴하기").is_disabled())
    wp.get_by_placeholder("여기에 직접 입력").fill("탈퇴합니다.")
    check(f"{TAG} T11 마침표 붙은 문구도 버튼 켜짐", wp.get_by_role("button", name="탈퇴하기").is_enabled())
    wp.get_by_placeholder("여기에 직접 입력").fill("이사 가서 안 써요")
    # 통신이 끊기면: 처리 중으로 잠기지 않고 확인 안내가 나오며 버튼을 다시 쓸 수 있음, 계정은 그대로
    wp.route("**/api/me/withdraw", lambda r: r.abort())
    wp.get_by_role("button", name="탈퇴하기").click(); wp.wait_for_selector("text=결과를 확인하지 못했어요", timeout=30000)
    check(f"{TAG} T11 통신이 끊기면 확인 안내, 버튼 다시 사용 가능, 계정 그대로", wp.get_by_role("button", name="탈퇴하기").is_enabled() and q("select status from users where id=?", wid)[0][0] == "ACTIVE")
    wp.screenshot(path=f"{OUT}/withdraw_{TAG}_network_error.png", full_page=True)
    wp.unroute("**/api/me/withdraw")
    wc.clear_cookies()
    wp.get_by_role("button", name="탈퇴하기").click(); wp.wait_for_selector("text=로그인이 끝났어요", timeout=30000)
    check(f"{TAG} T11 세션이 끊기면 '탈퇴가 끝났어요'가 안 나오고 계정은 그대로", wp.locator("text=탈퇴가 끝났어요").count() == 0 and q("select status from users where id=?", wid)[0][0] == "ACTIVE")
    wp.screenshot(path=f"{OUT}/withdraw_{TAG}_expired.png", full_page=True)
    wc.close(); wc, wp, wid2 = login(KID, W_NICK)
    check(f"{TAG} 같은 카카오로 다시 로그인하면 같은 계정", wid2 == wid)
    wp.goto(B + "/me/account", wait_until="load"); open_withdraw(wp)
    wp.get_by_placeholder("여기에 직접 입력").fill("탈퇴합니다")
    wp.screenshot(path=f"{OUT}/withdraw_{TAG}_form.png", full_page=True)
    old_cookie = "; ".join(f"{k['name']}={k['value']}" for k in wc.cookies())
    sess = lambda ck: json.loads(urllib.request.urlopen(urllib.request.Request(B + "/api/session", headers={"Cookie": ck}), timeout=30).read())
    check(f"{TAG} T1 탈퇴 전: 이 쿠키로 로그인 상태", sess(old_cookie).get("user") is not None)
    check(f"{TAG} T11 탈퇴 전: 화면에 계좌 정보·계좌 삭제 버튼·알림 수 있음", "1234" in wp.inner_text("body") and wp.get_by_role("button", name="계좌 삭제").count() == 1 and wp.locator(".top-chat__badge").count() >= 1)
    wp.get_by_role("button", name="탈퇴하기").click()
    wp.wait_for_url("**/withdrawn", timeout=90000); wp.wait_for_selector("text=탈퇴가 끝났어요", timeout=30000); wp.wait_for_timeout(2500)
    wp.screenshot(path=f"{OUT}/withdraw_{TAG}_done.png", full_page=True)
    check(f"{TAG} T11 화면에서 탈퇴 끝", q("select status, nickname from users where id=?", wid)[0] == ("WITHDRAWN", "탈퇴한 사용자"))
    done_body = wp.inner_text("body")
    check(f"{TAG} T11 완료 화면에 계좌 정보·계좌 버튼·알림 수 0건, 이 브라우저는 비로그인", "1234" not in done_body and "예금주" not in done_body and wp.get_by_role("button", name="계좌 삭제").count() == 0 and wp.locator(".top-chat__badge").count() == 0 and wc.request.get(B + "/api/session").json().get("user") is None)

    # ── T1 로그인 불가·이름 가리기(채팅·알림·후기) ──
    check(f"{TAG} T1 탈퇴 전 쿠키를 그대로 다시 써도 비로그인", sess(old_cookie).get("user") is None)
    op.goto(B + f"/chats/{th}", wait_until="load"); op.wait_for_timeout(1500)
    body = op.inner_text("body"); op.screenshot(path=f"{OUT}/withdraw_{TAG}_other_chat.png", full_page=True)
    check(f"{TAG} T1 상대 채팅 화면에 원래 닉네임 0건, '탈퇴한 사용자' 보임", W_NICK not in body and "탈퇴한 사용자" in body)
    op.goto(B + "/notifications", wait_until="load"); op.wait_for_timeout(800)
    check(f"{TAG} T1 상대 알림함에 원래 닉네임 0건", W_NICK not in op.inner_text("body"))
    op.goto(B + f"/sellers/{oid_}?tab=reviews", wait_until="load"); op.wait_for_timeout(800)
    check(f"{TAG} T1 상대 판매자 채널 후기에 원래 닉네임 0건, '탈퇴한 사용자' 보임", W_NICK not in op.inner_text("body") and "탈퇴한 사용자" in op.inner_text("body"))
    # ── T4 내 데이터 ──
    post = per_user(wid)
    others_post = {t: q(f"select count(*) from {t} where user_id<>?", wid)[0][0] for t in DEL}
    check(f"{TAG} T4 8개 표의 탈퇴자 줄 0", all(v == 0 for v in post.values()), post)
    check(f"{TAG} T4 다른 사용자 줄 수는 그대로(알림은 제안 취소 알림만 늘 수 있음)", all(others_post[t] == others_pre[t] for t in DEL if t != "notifications") and others_post["notifications"] >= others_pre["notifications"], (others_pre, others_post))
    # ── T3 상품 ──
    st = {k: q("select status from listings where id=?", L[k])[0][0] for k in ["ACTIVE", "HIDDEN", "RESERVED", "SOLD"]}
    check(f"{TAG} T3 ACTIVE·HIDDEN·RESERVED → REMOVED, SOLD 그대로", st == {"ACTIVE": "REMOVED", "HIDDEN": "REMOVED", "RESERVED": "REMOVED", "SOLD": "SOLD"}, st)
    # ── T7 알림 격리 ──
    check(f"{TAG} T7 상대 채팅 알림은 '탈퇴한 사용자님이…'로 바뀜", q("select body from notifications where user_id=? and url=?", oid_, f"/chats/{th}")[0][0] == "탈퇴한 사용자님이 메시지를 보냈어요.")
    check(f"{TAG} T7 같은 닉네임 다른 사람의 알림은 그대로", q("select id, body from notifications where user_id=? and url=?", t2, f"/chats/{th2}") == twin_before)
    check(f"{TAG} T7 탈퇴자 상품 거절 알림은 답글이 빠짐", q("select count(*) from notifications where user_id=? and url=? and body='판매자가 제안을 거절했어요.'", b3, f"/listings/{L['PROP2']}")[0][0] == 1)
    check(f"{TAG} T7 다른 판매자의 같은 답글 거절 알림은 그대로", q("select id, body from notifications where user_id=? and url=?", b3, f"/listings/{other_lid}") == other_decl_before)
    # ── T14 제안 ──
    P = lambda pid: q("select status, message, seller_reply from trial_proposals where id=?", pid)[0]
    check(f"{TAG} T14 탈퇴자 상품의 PENDING → CANCELLED", P(p_pending)[0] == "CANCELLED")
    check(f"{TAG} T14 주문에 안 쓰인 ACCEPTED → CANCELLED, 답글 비움", P(p_free)[0] == "CANCELLED" and P(p_free)[2] is None)
    check(f"{TAG} T14 완료 거래에 쓰인 ACCEPTED는 상태 그대로, 답글만 비움", P(p_used)[0] == "ACCEPTED" and P(p_used)[2] is None)
    check(f"{TAG} T14 DECLINED는 상태 그대로, 답글 비움", P(p_declined)[0] == "DECLINED" and P(p_declined)[2] is None)
    check(f"{TAG} T14 탈퇴자가 낸 PENDING 제안은 취소되고 한마디 비움", P(p_mine)[0] == "CANCELLED" and P(p_mine)[1] is None)
    check(f"{TAG} T14 탈퇴자가 낸 CANCELLED·EXPIRED는 상태 그대로, 한마디 비움", P(p_mc)[:2] == ("CANCELLED", None) and P(p_me)[:2] == ("EXPIRED", None), (P(p_mc), P(p_me)))
    check(f"{TAG} T14 탈퇴자 상품의 CANCELLED·EXPIRED는 상태 그대로, 답글 비움", (P(p_lc)[0], P(p_lc)[2]) == ("CANCELLED", None) and (P(p_le)[0], P(p_le)[2]) == ("EXPIRED", None), (P(p_lc), P(p_le)))
    check(f"{TAG} T14 다른 판매자 상품의 제안은 그대로", P(p_other)[0] == "DECLINED" and P(p_other)[2] == REPLY)
    cn = q("select title, body, url, dedupe_key from notifications where user_id=? and dedupe_key=?", oid_, f"withdraw-proposal-{p_pending}")
    check(f"{TAG} T14 취소 알림 내용 고정", cn and cn[0][1] == "판매자가 탈퇴해 제안이 취소됐어요." and cn[0][2] == "/me" and cn[0][0].startswith("써보기 제안 취소 · "), cn)
    op.goto(B + "/notifications", wait_until="load")
    op.locator("a[href='/me']", has_text="판매자가 탈퇴해").first.click(); op.wait_for_url(B + "/me")
    check(f"{TAG} T14 취소 알림을 누르면 /me가 열림", op.url == B + "/me" and "페이지를 찾을 수 없" not in op.inner_text("body"))
    # ── T15 통계 ──
    ev_after = q(f"select distinct user_id from market_validation_events where id in ({','.join('?' * len(ev_ids))})", *ev_ids) if ev_ids else []
    check(f"{TAG} T15 탈퇴자 통계 {len(ev_ids)}줄이 모두 같은 가명 하나로 바뀜", len(ev_ids) >= 1 and len(ev_after) == 1 and ev_after[0][0].startswith("wd_") and q("select count(*) from market_validation_events where user_id=?", ev_after[0][0])[0][0] == len(ev_ids), ev_after)
    ev_others_after = q(f"select id, user_id from market_validation_events where user_id is not ? and id not in ({','.join('?' * len(ev_ids))}) order by id", wid, *ev_ids)
    check(f"{TAG} T15 다른 사용자 통계 줄은 그대로", [r for r in ev_others_after if r[0] in {e[0] for e in ev_others}] == ev_others, len(ev_others))
    # ── T6 탈퇴자에게 채팅·후기 ──
    keep = q("select id, title, body, read_at from notifications where user_id=? and url=?", oid_, f"/chats/{th}")
    cm, nm = q("select count(*) from chat_messages")[0][0], q("select count(*) from notifications")[0][0]
    r6 = oc.request.post(f"{B}/api/chats/{th}", data={"body": "아직 계세요?"})
    check(f"{TAG} T6 탈퇴자에게 채팅 409, 메시지·알림 증가 0", r6.status == 409 and q("select count(*) from chat_messages")[0][0] == cm and q("select count(*) from notifications")[0][0] == nm, r6.status)
    check(f"{TAG} T6 이미 있던 채팅 알림의 제목·본문·읽음 그대로", q("select id, title, body, read_at from notifications where user_id=? and url=?", oid_, f"/chats/{th}") == keep)
    rv = oc.request.post(f"{B}/api/orders/{day9}/review", data={"type": "TRADE", "stars": 9, "chips": ["친절해요"], "descMatch": True, "compMatch": True})
    check(f"{TAG} T6 9일 전 끝난 거래: 상대가 탈퇴자 후기 저장(201), 탈퇴자 알림 0", rv.status == 201 and q("select count(*) from reviews where order_id=?", day9)[0][0] == 1 and q("select count(*) from notifications where user_id=?", wid)[0][0] == 0, (rv.status, rv.text()[:120]))
    # ── T5-2 이미 탈퇴한 쿠키로 다시 요청 → already ──
    check(f"{TAG} T5 쿠키가 지워진 뒤 다시 요청 → 401(로그인 끝), 탈퇴 기록 1번", wc.request.post(B + "/api/me/withdraw", data={"confirm": "탈퇴합니다"}).status == 401 and q("select count(*) from users where id=? and withdrawn_at is not null", wid)[0][0] == 1)
    # ── T8 같은 카카오로 재가입 → 새 계정 ──
    rc, _, rid = login(KID, f"다시{TAG}{KID % 1000}")
    check(f"{TAG} T8 같은 카카오로 다시 오면 새 계정", rid != wid and q("select status from users where id=?", rid)[0][0] == "ACTIVE")
    check(f"{TAG} 화면 오류 0건", not errs, errs[:3])
    b.close()
print(f"== {sum(res)}/{len(res)} 통과, 실패 {len(res) - sum(res)}")
sys.exit(0 if all(res) else 1)
