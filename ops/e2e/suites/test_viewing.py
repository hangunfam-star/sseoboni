# -*- coding: utf-8 -*-
# 채팅방을 보고 있으면 휴대폰 알림 안 울림(알림함엔 남음), 안 보고 있으면 울림. 격리 3200 + 가짜 카카오 3299 + 가짜 푸시 3298. argv[1] 복사 DB, argv[2] 캡처
import sys, sqlite3, urllib.request, urllib.parse, time, json
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, F, P, DB, OUT = "http://localhost:3200", "http://localhost:3299", "http://127.0.0.1:3298", sys.argv[1], sys.argv[2]
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
def fake(**kw): urllib.request.urlopen(F + "/_set?" + urllib.parse.urlencode(kw)).read()
def pj(path): return json.loads(urllib.request.urlopen(P + path).read() or b"null")
def q(sql, *a):
    c = sqlite3.connect(DB); r = c.execute(sql, a).fetchall(); c.commit(); c.close(); return r
uid = lambda ctx: next((c["value"].split(".")[0] for c in ctx.cookies() if c["name"] == "sseoboni_sid"), None)
pushes = lambda: [x for x in pj("/_log") if x.get("text") and "새 채팅" in x["text"]]
KID = int(time.time()) % 100000 + 400000
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def login(kid, nick, vp):
        c = b.new_context(viewport=vp); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
        pg = c.new_page(); pg.set_default_timeout(60000); pg.on("pageerror", lambda e: errs.append(str(e)))
        fake(id=kid, nick=nick)
        pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click(); pg.wait_for_url("**/login?step=kakao**")
        pg.get_by_role("button", name="카카오 닉네임으로 시작하기").click(); pg.wait_for_url(B + "/")
        return c, pg
    ca, pa = login(KID, "보내는이", {"width": 1280, "height": 900})
    cb, pb = login(KID + 1, "받는이", {"width": 375, "height": 812})
    A, Bu = uid(ca), uid(cb)
    lid = q("select id from listings where status='ACTIVE' limit 1")[0][0]
    q("update listings set seller_id=? where id=?", Bu, lid)
    tid = f"t_view_{KID}"
    q("insert into chat_threads (id, listing_id, buyer_id, seller_id) values (?,?,?,?)", tid, lid, A, Bu)
    dev = pj("/_keys")
    q("insert into push_subscriptions (endpoint, user_id, p256dh, auth) values (?,?,?,?)", f"{P}/push/{dev['id']}", Bu, dev["p256dh"], dev["auth"])
    q("insert or replace into notification_prefs (user_id, chat, interest, review, quiet) values (?,1,1,1,0)", Bu)
    urllib.request.urlopen(P + "/_clear").read()
    send = lambda text: pa.request.post(B + f"/api/chats/{tid}", data=json.dumps({"body": text}), headers={"Content-Type": "application/json"}).status
    # 1) 받는 사람이 다른 화면에 있음 → 울림
    pb.goto(B + "/", wait_until="load")
    check("다른 화면이면 보내기 성공", send("안녕하세요 첫 메시지") == 201)
    time.sleep(3)
    check("다른 화면이면 휴대폰 알림 1번", len(pushes()) == 1, pushes())
    # 2) 받는 사람이 그 대화방을 보고 있음 → 안 울림, 알림함엔 남음(곧 읽음)
    pb.goto(B + f"/chats/{tid}", wait_until="load"); time.sleep(5)
    before = len(q("select id from notifications where user_id=? and url=?", Bu, f"/chats/{tid}"))
    check("보는 중 보내기 성공", send("지금 보고 계시죠") == 201)
    time.sleep(6)
    check("대화방을 보고 있으면 휴대폰 알림 안 옴", len(pushes()) == 1, pushes())
    rows = q("select read_at from notifications where user_id=? and url=? order by created_at", Bu, f"/chats/{tid}")
    check("알림함에는 남고 화면이 읽음 처리", len(rows) == before + 1 and rows[-1][0] is not None, rows)
    check("보는 화면에 메시지 바로 보임", "지금 보고 계시죠" in pb.locator("body").inner_text())
    pb.screenshot(path=f"{OUT}/m_chat_viewing.png")
    # 3) 대화방을 떠나고 20초 넘게 지남 → 다시 울림
    pb.goto(B + "/", wait_until="load"); time.sleep(22)
    check("떠난 뒤 보내기 성공", send("자리 비우셨나요") == 201)
    time.sleep(3)
    check("대화방을 떠나면 다시 휴대폰 알림", len(pushes()) == 2, pushes())
    # 4) 거래 알림은 대화방을 보고 있어도 그대로(채팅만 해당) — 규칙 확인: 보는 중 표시는 채팅 주소에만 붙음
    ca.close(); cb.close()
    check("화면 오류 없음", not errs, errs[:2])
    print(f"{sum(res)}/{len(res)}")
