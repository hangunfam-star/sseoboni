# -*- coding: utf-8 -*-
# 카카오 닉네임 그대로 쓰기 / 써보니 닉네임 만들기 선택 시험(격리 3200 + 가짜 카카오 3299). argv[1] 복사 DB, argv[2] 캡처
import sys, sqlite3, urllib.request, urllib.parse
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, F, DB, OUT = "http://localhost:3200", "http://localhost:3299", sys.argv[1], sys.argv[2]
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
def fake(**kw): urllib.request.urlopen(F + "/_set?" + urllib.parse.urlencode(kw)).read()
def q(sql, *a):
    c = sqlite3.connect(DB); r = c.execute(sql, a).fetchall(); c.close(); return r
uid = lambda ctx: next((c["value"].split(".")[0] for c in ctx.cookies() if c["name"] == "sseoboni_sid"), None)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    for tag, vp, base in [("m", {"width": 375, "height": 812}, 9100), ("pc", {"width": 1280, "height": 900}, 9200)]:
        def start(kid, nick):
            c = b.new_context(viewport=vp); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
            pg = c.new_page(); pg.set_default_timeout(60000); pg.on("pageerror", lambda e: errs.append(str(e)))
            fake(id=kid, nick=nick)
            pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click(); pg.wait_for_url("**/login?step=kakao**")
            return c, pg
        # 1) 카카오 닉네임 그대로 쓰기(기본 선택)
        c, pg = start(base + 1, f"카톡이름{tag}")
        check(f"{tag} 선택지 2개·카카오 닉네임 보임·기본은 그대로 쓰기", pg.locator(".nick-choice__item").count() == 2 and f"카톡이름{tag}" in pg.locator(".nick-choice").inner_text() and pg.get_by_role("radio").first.is_checked() and pg.locator("input[autocomplete='nickname']").count() == 0)
        pg.screenshot(path=f"{OUT}/{tag}_nick_choice.png", full_page=True)
        pg.get_by_role("button", name="카카오 닉네임으로 시작하기").click(); pg.wait_for_url(B + "/")
        check(f"{tag} 카카오 닉네임으로 가입", q("select nickname from users where id=?", uid(c))[0][0] == f"카톡이름{tag}")
        c.close()
        # 2) 써보니 닉네임 새로 만들기
        c, pg = start(base + 2, f"카톡둘{tag}")
        pg.get_by_role("radio").nth(1).check()
        check(f"{tag} 새로 만들기 고르면 입력칸·버튼 글자 바뀜", pg.locator("input[autocomplete='nickname']").count() == 1 and pg.get_by_role("button", name="이 닉네임으로 시작하기").count() == 1)
        pg.get_by_role("button", name="이 닉네임으로 시작하기").click(); pg.wait_for_timeout(700)
        check(f"{tag} 빈 칸이면 오류", "2~12자" in pg.locator("body").inner_text())
        pg.get_by_role("radio").first.check(); pg.wait_for_timeout(200)
        check(f"{tag} 다시 그대로 쓰기 고르면 입력칸 숨김", pg.locator("input[autocomplete='nickname']").count() == 0)
        pg.get_by_role("radio").nth(1).check(); pg.fill("input[autocomplete='nickname']", f"써보니명{tag}"); pg.keyboard.press("Enter"); pg.wait_for_url(B + "/")
        check(f"{tag} 써보니 닉네임으로 가입", q("select nickname from users where id=?", uid(c))[0][0] == f"써보니명{tag}")
        c.close()
        # 3) 카카오 닉네임이 12자 넘음 / 4) 닉네임 제공 안 함 → 입력칸만
        for k, nick, name in [(base + 3, "가나다라마바사아자차카타파하", "12자 넘음"), (base + 4, "", "제공 안 함")]:
            c, pg = start(k, nick)
            ok = pg.locator(".nick-choice").count() == 0 and pg.locator("input[autocomplete='nickname']").count() == 1
            r = c.request.post(B + "/api/auth/kakao/complete", data={"useKakao": True})
            check(f"{tag} 카카오 닉네임 {name} → 입력칸만·그대로 쓰기 요청 400", ok and r.status == 400, r.status)
            c.close()
    check("화면 오류 없음", not errs, errs[:2])
    print(f"{sum(res)}/{len(res)}")
