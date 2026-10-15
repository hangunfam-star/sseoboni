# -*- coding: utf-8 -*-
# 계정 복구(운영자 1회용 링크 + 예전 주소 로그인 이어받기). 격리 3200(새 주소 역할, 복사 DB) + 이동 서버 3201(예전 주소 역할).
# argv[1] 복사 DB, argv[2] 캡처 폴더, argv[3] pc|m
import sys, sqlite3
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
NEW, OLD, DB, OUT, TAG = "http://localhost:3200", "http://127.0.0.1:3201", sys.argv[1], sys.argv[2], sys.argv[3]
VP = {"pc": {"width": 1280, "height": 900}, "m": {"width": 375, "height": 812}}[TAG]
ENV = {l.split("=", 1)[0]: l.split("=", 1)[1].strip().strip('"') for l in open(r"E:\PROJECTS\04_써보니\app\.env", encoding="utf-8") if "=" in l and not l.startswith("#")}
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", f"{TAG} {n}", "" if ok else d, flush=True)
def q(sql, *a):
    c = sqlite3.connect(DB); r = c.execute(sql, a).fetchall(); c.commit(); c.close(); return r
def sid(ctx, host="localhost"):
    for ck in ctx.cookies():
        if ck["name"] == "sseoboni_sid" and host in ck["domain"]: return ck["value"]
uid = lambda ctx: (sid(ctx) or "").split(".")[0] or None
with sync_playwright() as p:
    b = p.chromium.launch()
    errs = []
    def new():
        c = b.new_context(viewport=VP); c.add_init_script("try{sessionStorage.setItem('sb_splash','1')}catch(e){}")
        c.grant_permissions(["clipboard-read", "clipboard-write"], origin=NEW)
        pg = c.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); return c, pg
    def start(pg, nick):  # 닉네임 시작 화면은 없어짐(2026-10-14) — 격리 시험 서버 전용 API로 계정 생성
        assert pg.context.request.post(NEW + "/api/session", data={"nickname": nick}).ok
        pg.goto(NEW + "/", wait_until="load")

    # 준비: 복구할 계정 A
    ca, pa = new(); start(pa, f"복구대상{TAG}"); ua = uid(ca)
    # 안내 문구(로그아웃 상태)
    cx, px = new(); px.goto(NEW + "/me", wait_until="networkidle")
    check("로그아웃 MY에 복구 안내", "운영자에게 복구 링크" in px.inner_text("body")); px.screenshot(path=f"{OUT}/{TAG}_me_out.png", full_page=True)
    px.goto(NEW + "/login", wait_until="networkidle")
    check("시작 화면에 복구 안내", "운영자에게 복구 링크" in px.inner_text("body"))
    r = cx.request.post(NEW + "/api/admin/login-link", data={"userId": ua})
    check("운영자 아니면 링크 못 만듦(401)", r.status == 401, r.status)

    # 운영자 화면에서 링크 만들기
    cadm, padm = new()
    assert cadm.request.post(NEW + "/api/admin/session", data={"key": ENV["ADMIN_KEY"]}).ok
    padm.goto(NEW + "/admin", wait_until="networkidle")
    row = padm.locator(".admin-accounts li").filter(has_text=f"복구대상{TAG}")
    check("운영자 화면 계정 목록에 대상", row.count() == 1 and "카카오 미연결" in row.inner_text())
    row.get_by_role("button", name="복구 링크 만들기").click(); row.locator("code").wait_for(timeout=15000)
    link1 = row.locator("code").inner_text()
    check("링크 만들어짐(/login/link?t=)", link1.startswith(NEW + "/login/link?t="), link1)
    row.get_by_role("button", name="링크 복사").click(); padm.wait_for_timeout(300)
    check("링크 복사 버튼", "복사했어요" in row.inner_text() and padm.evaluate("navigator.clipboard.readText()") == link1)
    padm.once("dialog", lambda d: d.dismiss()); row.get_by_role("button", name="새 복구 링크 만들기").click(); padm.wait_for_timeout(500)
    check("새 링크 확인창 취소하면 그대로", row.locator("code").inner_text() == link1)
    padm.once("dialog", lambda d: d.accept()); row.get_by_role("button", name="새 복구 링크 만들기").click()
    padm.wait_for_function("(old) => { const c = [...document.querySelectorAll('.admin-accounts code')]; return c.some(x => x.textContent && x.textContent !== old); }", arg=link1, timeout=15000)
    link2 = row.locator("code").inner_text()
    check("새 링크 만들면 바뀜", link2 != link1 and link2.startswith(NEW + "/login/link?t="))
    padm.screenshot(path=f"{OUT}/{TAG}_admin.png", full_page=False)
    row.scroll_into_view_if_needed(); row.screenshot(path=f"{OUT}/{TAG}_admin_row.png")
    check("기록 남김(LOGIN_LINK_ISSUED)", q("select count(*) from market_validation_events where event_type='LOGIN_LINK_ISSUED' and metadata like ?", f"%{ua}%")[0][0] >= 2)

    # 링크 사용: 미리보기 로봇처럼 여러 번 열어도 소모 안 됨 → 버튼 눌러 들어감
    cb, pb = new()
    pb.goto(link1, wait_until="networkidle")
    check("예전 링크(새로 만들기 전)는 못 씀", "올바른 복구 링크가 아니에요" in pb.inner_text("body"))
    pb.get_by_role("link", name="처음 화면으로").click(); pb.wait_for_url("**/login", timeout=15000)
    check("처음 화면으로 버튼", pb.url.endswith("/login"))
    cb.request.get(link2); cb.request.get(link2)
    pb.goto(link2, wait_until="networkidle")
    check("링크를 열기만 하면 소모 안 됨·닉네임 표시", f"복구대상{TAG}" in pb.inner_text("body") and q("select used_at from login_links where user_id=?", ua)[0][0] is None)
    pb.screenshot(path=f"{OUT}/{TAG}_link.png", full_page=True)
    start_other = uid(cb)
    pb.get_by_role("button", name=f"복구대상{TAG} 계정으로 들어가기").click(); pb.wait_for_url("**/me?recovered=1", timeout=15000); pb.wait_for_load_state("networkidle")
    check("버튼 누르면 원래 계정으로·안내", uid(cb) == ua and "원래 계정으로 들어왔어요" in pb.inner_text("body") and start_other is None, (uid(cb), ua))
    pb.screenshot(path=f"{OUT}/{TAG}_me_recovered.png", full_page=False)
    pb.goto(link2, wait_until="networkidle")
    check("한 번 쓴 링크는 다시 못 씀", "이미 사용했어요" in pb.inner_text("body"))
    r = cb.request.post(NEW + "/api/auth/login-link", data={"t": link2.split("t=")[1]})
    check("한 번 쓴 링크 POST는 410", r.status == 410, r.status)

    # 다른 계정으로 들어와 있어도 링크 계정으로 바뀜 / 기간 지난 링크
    cc, pc_ = new(); start(pc_, f"다른사람{TAG}"); uc = uid(cc)
    r = cadm.request.post(NEW + "/api/admin/login-link", data={"userId": ua}); link3 = r.json()["url"]
    pc_.goto(link3, wait_until="networkidle"); pc_.get_by_role("button", name=f"복구대상{TAG} 계정으로 들어가기").click(); pc_.wait_for_url("**/me?recovered=1", timeout=15000)
    check("다른 계정 상태에서도 링크 계정으로 바뀜", uid(cc) == ua and uc != ua)
    r = cadm.request.post(NEW + "/api/admin/login-link", data={"userId": uc}); link4 = r.json()["url"]
    q("update login_links set expires_at='2000-01-01T00:00:00.000Z' where user_id=? and used_at is null", uc)
    pc_.goto(link4, wait_until="networkidle")
    check("기간 지난 링크 안내", "24시간" in pc_.inner_text("body") and "지났어요" in pc_.inner_text("body"))
    pc_.goto(NEW + "/login/link?t=zzz", wait_until="networkidle")
    check("엉터리 링크 안내", "올바른 복구 링크가 아니에요" in pc_.inner_text("body"))
    r = cadm.request.post(NEW + "/api/admin/login-link", data={"userId": "u_없음"})
    check("없는 계정은 404", r.status == 404, r.status)

    # 예전 주소 이어받기: 예전 주소(127.0.0.1:3201)에 있던 로그인 쿠키로 새 주소에 같은 계정
    cd, pd = new()
    cd.add_cookies([{"name": "sseoboni_sid", "value": sid(ca), "url": OLD}])
    pd.goto(OLD + "/wishlist", wait_until="networkidle")
    check("예전 링크 → 새 주소 찜 화면·같은 계정", pd.url == NEW + "/wishlist" and uid(cd) == ua, (pd.url, uid(cd)))
    r = cd.request.get(OLD + "/me", max_redirects=0)
    loc = r.headers.get("location", "")
    check("이동은 302·기억 안 함(no-store)", r.status == 302 and r.headers.get("cache-control") == "no-store" and "/api/auth/carry?t=" in loc, (r.status, r.headers.get("cache-control")))
    ce, pe = new()
    r1 = ce.request.get(loc, max_redirects=0); ce_uid1 = uid(ce)
    ce.clear_cookies(); r2 = ce.request.get(loc, max_redirects=0)
    check("이어받기 표는 한 번만", ce_uid1 == ua and uid(ce) is None, (ce_uid1, uid(ce)))
    tampered = loc.replace("t=", "t=x", 1)
    cf, pf = new(); cf.request.get(tampered, max_redirects=0)
    check("위조 표는 무시", uid(cf) is None)
    r = cf.request.get(OLD + "/me", max_redirects=0)
    check("쿠키 없으면 표 없이 이동", r.status == 302 and r.headers.get("location") == NEW + "/me")
    cg, pg_ = new(); start(pg_, f"새주소사람{TAG}"); ug = uid(cg)
    cg.add_cookies([{"name": "sseoboni_sid", "value": sid(ca), "url": OLD}])
    pg_.goto(OLD + "/me", wait_until="networkidle")
    check("새 주소에 이미 들어와 있으면 안 바꿈", uid(cg) == ug != ua)
    bad = sid(ca).rsplit(".", 1)[0] + ".AAAA"
    ch, ph = new(); ch.add_cookies([{"name": "sseoboni_sid", "value": bad, "url": OLD}])
    ph.goto(OLD + "/me", wait_until="networkidle")
    check("서명 틀린 예전 쿠키는 이어받지 않음", uid(ch) is None and "/api/auth/carry" not in ph.url)
    check("화면 오류 없음", not errs, errs[:2])
    print(f"{TAG} {sum(res)}/{len(res)}")
