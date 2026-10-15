# -*- coding: utf-8 -*-
# Codex v1.4 지적 5건 수정 확인(격리 3200 개발 서버, 닉네임 시험 계정 허용, 복사 DB). argv[1] 복사 DB, argv[2] 캡처, argv[3] 설정 파일
# 2.1 운영 빌드 확인은 test_prod.py에서 따로 한다.
import sys, sqlite3, json, time, urllib.request, subprocess
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, DB, OUT, TS = "http://localhost:3200", sys.argv[1], sys.argv[2], sys.argv[3]
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
def q(sql, *a):
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; r = c.execute(sql, a).fetchall(); c.commit(); c.close(); return r
uid = lambda ctx: next((c["value"].split(".")[0] for c in ctx.cookies() if c["name"] == "sseoboni_sid"), None)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def ctx(nick=None, vp={"width": 375, "height": 812}):
        c = b.new_context(viewport=vp); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
        if nick: assert c.request.post(B + "/api/session", data={"nickname": nick}).ok
        return c
    seller, buyer = ctx("코덱스14판매"), ctx("코덱스14구매")
    su, bu = uid(seller), uid(buyer)
    # 2.3 남의 기기 덮어쓰기 거부, 내 기기 갱신은 됨
    ep = "https://push.example/ep-" + str(int(time.time()))
    r1 = seller.request.post(B + "/api/push", data={"endpoint": ep, "keys": {"p256dh": "AAA", "auth": "BBB"}})
    r2 = buyer.request.post(B + "/api/push", data={"endpoint": ep, "keys": {"p256dh": "CCC", "auth": "DDD"}})
    r3 = seller.request.post(B + "/api/push", data={"endpoint": ep, "keys": {"p256dh": "EEE", "auth": "FFF"}})
    row = q("select user_id, p256dh from push_subscriptions where endpoint=?", ep)[0]
    check("남의 푸시 기기 등록은 409·소유자 그대로", r1.status == 201 and r2.status == 409 and r3.status == 201 and row["user_id"] == su and row["p256dh"] == "EEE", (r1.status, r2.status, r3.status, dict(row)))
    # 같은 기기를 다른 계정이 켜면 브라우저가 새 구독을 만들어 등록(409 → 재구독)
    stub = """(() => { let n = 0; const mk = (ep) => ({ endpoint: ep, toJSON() { return { endpoint: ep, keys: { p256dh: 'P' + ep.slice(-4), auth: 'A' + ep.slice(-4) } }; }, unsubscribe: async () => { window.__unsub = (window.__unsub || 0) + 1; window.__sub = null; return true; } });
      Object.defineProperty(Notification, 'permission', { configurable: true, get: () => 'granted' });
      const saved = localStorage.getItem('stub_ep'); window.__sub = saved === 'none' ? null : mk(saved || '%s');
      const keep = () => localStorage.setItem('stub_ep', window.__sub ? window.__sub.endpoint : 'none');
      const mk2 = mk; window.__mk = mk2;
      PushManager.prototype.getSubscription = async function () { return window.__sub; };
      PushManager.prototype.subscribe = async function () { n++; window.__sub = mk('%s-new' + n); keep(); return window.__sub; };
      const un = (s) => { const u = s.unsubscribe; s.unsubscribe = async () => { await u(); keep(); return true; }; return s; }; if (window.__sub) un(window.__sub);
      const sub0 = PushManager.prototype.subscribe; PushManager.prototype.subscribe = async function () { return un(await sub0.call(this)); }; })();""" % (ep, ep)
    cb = ctx(); cb.add_cookies(buyer.cookies()); cb.add_init_script(stub)
    pg = cb.new_page(); pg.set_default_timeout(60000); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(B + "/me/notifications", wait_until="load")
    pg.get_by_role("button", name="알림 켜기").click(); pg.get_by_text("켜짐 · 이 기기로 알림을 받아요").wait_for(timeout=60000)
    mine = q("select endpoint from push_subscriptions where user_id=?", bu)
    check("같은 기기 다른 계정: 새 구독으로 등록·원래 소유자 유지", pg.evaluate("window.__unsub") == 1 and any(r["endpoint"].startswith(ep + "-new") for r in mine) and q("select user_id from push_subscriptions where endpoint=?", ep)[0]["user_id"] == su, [r["endpoint"] for r in mine])
    # 로그아웃하면 이 기기 구독 해제
    pg.goto(B + "/me", wait_until="load"); pg.once("dialog", lambda d: d.accept())
    pg.get_by_role("button", name="로그아웃").click(); pg.wait_for_url("**/login", timeout=60000)
    check("로그아웃하면 이 기기 알림 구독 삭제", not q("select 1 from push_subscriptions where user_id=? and endpoint like ?", bu, ep + "-new%"), [r["endpoint"] for r in q("select endpoint from push_subscriptions where user_id=?", bu)])
    # 2.4 채팅 알림에 원문 없음
    lid = seller.request.post(B + "/api/listings", data={"modelId": seller.request.get(B + "/api/models").json()["models"][0]["id"], "title": "코덱스14 채팅 시험", "price": 50000, "conditionGrade": "A", "description": "시험", "tryWillingness": "NO", "components": ["본체"]}).json()["listing"]["id"]
    tid = buyer.request.post(B + "/api/chats", data={"listingId": lid}).json()
    tid = tid.get("threadId") or tid.get("thread", {}).get("id")
    secret = "서울시 강남구 테헤란로 123 101동 202호 비밀번호 1234"
    buyer.request.post(f"{B}/api/chats/{tid}", data={"body": secret})
    n = q("select title, body from notifications where user_id=? and category='CHAT' order by created_at desc limit 1", su)
    check("채팅 알림 제목·본문에 메시지 원문 없음", n and "테헤란로" not in (n[0]["title"] + n[0]["body"]) and "메시지를 보냈어요" in n[0]["body"], [dict(x) for x in n])
    # 2.5 거래 열림/닫힘에 맞는 안내
    for open_, want, avoid in [(True, "수수료는 0원", "결제와 배송은 일어나지 않아요"), (False, "결제와 배송은 일어나지 않아요", "수수료는 0원")]:
        json.dump({"tradeOpen": open_}, open(TS, "w"))
        c = ctx(); pg2 = c.new_page(); pg2.set_default_timeout(60000)
        pg2.goto(B + "/", wait_until="load"); home = pg2.locator(".try-hero").first.inner_text()
        pg2.goto(B + "/login", wait_until="load"); login = pg2.locator(".login-card").inner_text()
        pg2.goto(B + "/", wait_until="load"); pg2.get_by_role("button", name="메뉴 열기").click(); menu = pg2.locator(".top-menu__note").inner_text()
        check(f"거래 {'열림' if open_ else '닫힘'}: 홈·시작·메뉴 안내 일치", all(want in t and avoid not in t for t in (home, login, menu)), (home[-80:], login[-80:], menu))
        if open_: pg2.goto(B + "/", wait_until="load"); pg2.locator(".try-hero").first.screenshot(path=f"{OUT}/m_mission_tradeopen.png")
        c.close()
    json.dump({"tradeOpen": True}, open(TS, "w"))
    check("화면 오류 없음", not errs, errs[:2])
    print(f"{sum(res)}/{len(res)}")
