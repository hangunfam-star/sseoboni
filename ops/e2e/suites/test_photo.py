# -*- coding: utf-8 -*-
# 카카오 프로필 사진 시험(격리 3200 + 가짜 카카오 3299). argv[1] 복사 DB, argv[2] 캡처 폴더
import sys, sqlite3, urllib.request, urllib.parse, json
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, F, DB, OUT = "http://localhost:3200", "http://localhost:3299", sys.argv[1], sys.argv[2]
PNG = open(r"E:\PROJECTS\04_써보니\app\public\icons\icon-192.png", "rb").read()
IMG1 = "https://k.kakaocdn.net/dn/test/one/img_110x110.jpg"
IMG2 = "http://k.kakaocdn.net/dn/test/two/img_110x110.jpg"  # http로 와도 https로 저장
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
def fake(**kw): urllib.request.urlopen(F + "/_set?" + urllib.parse.urlencode(kw)).read()
def q(sql, *a):
    c = sqlite3.connect(DB); r = c.execute(sql, a).fetchall(); c.commit(); c.close(); return r
uid = lambda ctx: next((c["value"].split(".")[0] for c in ctx.cookies() if c["name"] == "sseoboni_sid"), None)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def ctx(vp):
        c = b.new_context(viewport=vp); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
        c.route("**/*kakaocdn.net/**", lambda r: r.fulfill(status=200, body=PNG, content_type="image/png"))
        pg = c.new_page(); pg.set_default_timeout(60000); pg.on("pageerror", lambda e: errs.append(str(e)))
        return c, pg
    def login(pg, kid, nick, **img):
        fake(id=kid, nick=nick, **img)
        pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click()
    def toggle(pg, name):
        with pg.expect_response("**/api/profile-photo"): pg.get_by_role("button", name=name).click()
        pg.wait_for_timeout(2500)
    av_img = lambda pg: pg.locator(".my-head .seller-avatar img")
    for tag, vp, base in [("m", {"width": 375, "height": 812}, 9300), ("pc", {"width": 1280, "height": 900}, 9400)]:
        # 1) 사진 동의 + 닉네임 → 사진 쓰기(기본 켜짐)로 가입
        c, pg = ctx(vp); login(pg, base + 1, f"사진님{tag}", img=IMG1); pg.wait_for_url("**/login?step=kakao**")
        box = pg.locator(".photo-choice")
        check(f"{tag} 가입 화면에 카카오 사진·체크(기본 켜짐)", box.count() == 1 and box.locator("img").get_attribute("src") == IMG1 and box.locator("input").is_checked())
        pg.locator(".login-card").screenshot(path=f"{OUT}/{tag}_signup_photo.png")
        pg.get_by_role("button", name="카카오 닉네임으로 시작하기").click(); pg.wait_for_url(B + "/")
        me = uid(c)
        check(f"{tag} DB에 사진 주소·보이기 저장", q("select kakao_image_url, show_photo from users where id=?", me)[0] == (IMG1, 1))
        pg.goto(B + "/me", wait_until="load")
        check(f"{tag} MY에 사진 보임", av_img(pg).count() == 1 and av_img(pg).get_attribute("src") == IMG1 and av_img(pg).evaluate("e => e.naturalWidth") > 0)
        pg.locator(".my-head").screenshot(path=f"{OUT}/{tag}_my_photo.png")
        pg.goto(B + f"/sellers/{me}", wait_until="load")
        check(f"{tag} 판매자 채널에 사진", pg.locator(".my-header .seller-avatar img").count() == 1)
        pg.goto(B + "/me", wait_until="load")
        toggle(pg, "프로필 사진 숨기기")
        check(f"{tag} 숨기기 → 첫 글자로·DB 0", av_img(pg).count() == 0 and pg.locator(".my-head .seller-avatar").inner_text() == "사" and q("select show_photo from users where id=?", me)[0][0] == 0)
        pg.goto(B + f"/sellers/{me}", wait_until="load")
        check(f"{tag} 숨기면 판매자 채널에도 안 보임", pg.locator(".my-header .seller-avatar img").count() == 0)
        pg.goto(B + "/me", wait_until="load"); toggle(pg, "카카오 프로필 사진 보이기")
        check(f"{tag} 다시 보이기", av_img(pg).count() == 1 and q("select show_photo from users where id=?", me)[0][0] == 1)
        c.close()
        # 2) 다시 로그인하면 카카오 최신 사진으로 갱신(http → https)
        c, pg = ctx(vp); login(pg, base + 1, f"사진님{tag}", img=IMG2); pg.wait_for_url(B + "/")
        check(f"{tag} 재로그인 시 새 사진으로 갱신·https", q("select kakao_image_url from users where id=?", me)[0][0] == IMG2.replace("http://", "https://"))
        c.close()
        # 3) 가입 때 사진 끄기
        c, pg = ctx(vp); login(pg, base + 2, f"안보임{tag}", img=IMG1); pg.wait_for_url("**/login?step=kakao**")
        pg.locator(".photo-choice input").uncheck(); pg.get_by_role("button", name="카카오 닉네임으로 시작하기").click(); pg.wait_for_url(B + "/")
        m2 = uid(c); pg.goto(B + "/me", wait_until="load")
        check(f"{tag} 사진 끄고 가입 → 첫 글자·보이기 버튼", q("select show_photo from users where id=?", m2)[0][0] == 0 and av_img(pg).count() == 0 and pg.get_by_role("button", name="카카오 프로필 사진 보이기").count() == 1)
        c.close()
        # 4) 사진 동의 안 함 / 5) 카카오 기본 사진 / 6) 카카오 서버가 아닌 주소 → 사진 선택지 없음
        for i, (label, kw) in enumerate([("동의 안 함", {}), ("카카오 기본 사진", {"img": IMG1, "defimg": "1"}), ("다른 서버 주소", {"img": "https://evil.example.com/a.jpg"})]):
            c, pg = ctx(vp); login(pg, base + 3 + i, f"없음{i}{tag}", **kw); pg.wait_for_url("**/login?step=kakao**")
            no_box = pg.locator(".photo-choice").count() == 0
            pg.get_by_role("button", name="카카오 닉네임으로 시작하기").click(); pg.wait_for_url(B + "/")
            mid = uid(c); pg.goto(B + "/me", wait_until="load")
            check(f"{tag} {label} → 사진 선택지 없음·MY 첫 글자·사진 버튼 없음", no_box and q("select kakao_image_url from users where id=?", mid)[0][0] is None and av_img(pg).count() == 0 and pg.locator(".photo-toggle").count() == 0)
            c.close()
    # 7) 상품 상세 판매자 줄에 사진(복사 DB의 판매 중 상품 판매자에게 사진 넣음)
    lid, sid = q("select id, seller_id from listings where status='ACTIVE' limit 1")[0]
    q("update users set kakao_image_url=?, show_photo=1 where id=?", IMG1, sid)
    c, pg = ctx({"width": 375, "height": 812}); pg.goto(B + f"/listings/{lid}", wait_until="load")
    check("상품 상세 판매자 사진", pg.locator(".seller-row .seller-avatar img").count() == 1)
    pg.locator(".seller-row").screenshot(path=f"{OUT}/m_listing_seller.png")
    # 8) 사진 설정 API 막힘
    r1 = pg.request.post(B + "/api/profile-photo", data=json.dumps({"show": False}), headers={"Content-Type": "application/json"})
    check("로그인 없이 사진 설정 401", r1.status == 401)
    c.close()
    check("화면 오류 없음", not errs, errs[:2])
    print(f"{sum(res)}/{len(res)}")
