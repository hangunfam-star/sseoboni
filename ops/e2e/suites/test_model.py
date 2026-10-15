# -*- coding: utf-8 -*-
# 모델 입력 + 자동 채움(찾는 상품·상품 올리기). 격리 3200 + 가짜 카카오 3299. argv[1] 복사 DB, argv[2] 캡처
import sys, sqlite3, urllib.request, urllib.parse, time
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, F, DB, OUT = "http://localhost:3200", "http://localhost:3299", sys.argv[1], sys.argv[2]
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
def fake(**kw): urllib.request.urlopen(F + "/_set?" + urllib.parse.urlencode(kw)).read()
def q(sql, *a):
    c = sqlite3.connect(DB); r = c.execute(sql, a).fetchall(); c.close(); return r
KID = int(time.time()) % 100000 + 300000
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    for tag, vp, kid in [("m", {"width": 375, "height": 812}, KID), ("pc", {"width": 1280, "height": 900}, KID + 1)]:
        c = b.new_context(viewport=vp); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
        pg = c.new_page(); pg.set_default_timeout(60000); pg.on("pageerror", lambda e: errs.append(str(e)))
        fake(id=kid, nick=f"모델시험{tag}")
        pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click(); pg.wait_for_url("**/login?step=kakao**")
        pg.get_by_role("button", name="카카오 닉네임으로 시작하기").click(); pg.wait_for_url(B + "/")
        # 찾는 상품
        pg.goto(B + "/demand", wait_until="load")
        box = pg.locator(".demand-form .model-picker input")
        check(f"{tag} 찾는 상품: 선택 목록 대신 입력칸", pg.locator(".demand-form select").count() == 0 and box.count() == 1)
        box.click(); box.fill("그램"); pg.wait_for_timeout(300)
        opts = pg.locator(".model-picker__list [role=option]")
        check(f"{tag} '그램' 입력 → 맞는 모델만 뜸", opts.count() >= 1 and all("그램" in t for t in opts.all_inner_texts()), opts.all_inner_texts())
        pg.screenshot(path=f"{OUT}/{tag}_model_suggest.png")
        opts.first.click(); pg.wait_for_timeout(200)
        check(f"{tag} 누르면 입력칸 채움·등록 모델 표시·직접 입력칸 없음", "그램" in box.input_value() and pg.locator(".model-picker__ok").count() == 1 and pg.locator(".demand-form").get_by_text("브랜드", exact=True).count() == 0 and pg.locator(".model-picker__list").count() == 0)
        box.fill(""); box.type("맥북"); pg.keyboard.press("ArrowDown"); pg.keyboard.press("Enter"); pg.wait_for_timeout(300)
        check(f"{tag} 키보드(아래 화살표·Enter)로 고르기, 제출 안 됨", "MacBook" in box.input_value() and pg.locator(".demand-form .form-ok").count() == 0, box.input_value())
        name = f"소니 WH-1000XM5 {tag}{kid}"
        box.fill(name); pg.wait_for_timeout(200)
        check(f"{tag} 치는 동안에는 종류·브랜드 칸 안 나옴", pg.locator(".demand-form select").count() == 0)
        box.press("Tab"); pg.wait_for_timeout(200)
        check(f"{tag} 목록에 없는 이름 → 종류·브랜드 칸 나옴(모델명 칸은 따로 없음)", pg.locator(".demand-form select").count() == 1 and pg.get_by_placeholder("예: 애플, 소니").count() == 1 and pg.get_by_placeholder("예: 아이패드 에어 5세대").count() == 0)
        pg.locator(".demand-form select").select_option(index=1); pg.get_by_placeholder("예: 애플, 소니").fill("소니")
        pg.get_by_role("button", name="찾는 상품 남기기").click(); pg.wait_for_selector(".demand-form .form-ok, .demand-form .form-error")
        check(f"{tag} 직접 입력한 모델로 남기기 → 저장", pg.locator(".demand-form .form-ok").count() == 1 and q("select count(*) from product_models where model_name=?", name)[0][0] == 1, pg.locator(".demand-form [role=status]").all_inner_texts())
        mid, label = q("select m.id, m.brand || ' ' || m.model_name from product_models m where model_name=?", name)[0]
        pg.goto(B + f"/demand?model={mid}", wait_until="load")
        check(f"{tag} 모델 링크로 오면 미리 채워짐", pg.locator(".demand-form .model-picker input").input_value() == label, pg.locator(".demand-form .model-picker input").input_value())
        # 상품 올리기
        pg.goto(B + "/listings/new", wait_until="load"); pg.wait_for_timeout(1500)
        lb = pg.locator(".model-picker input")
        check(f"{tag} 상품 올리기도 입력칸", lb.count() == 1 and pg.locator("select:has(option:text('모델을 선택하세요'))").count() == 0)
        lb.fill("갤럭시북"); pg.wait_for_timeout(300); pg.locator(".model-picker__list [role=option]").first.click()
        check(f"{tag} 상품 올리기 고르기", "갤럭시북" in lb.input_value() and pg.locator(".model-picker__ok").count() == 1)
        lb.fill("없는모델 XYZ"); lb.press("Enter"); pg.wait_for_timeout(200)
        check(f"{tag} 상품 올리기 직접 입력 → 종류·브랜드 칸", pg.get_by_placeholder("예: 소니, 조이트론, 브랜드 없음").count() == 1)
        pg.screenshot(path=f"{OUT}/{tag}_listing_custom.png")
        c.close()
    check("화면 오류 없음", not errs, errs[:2])
    print(f"{sum(res)}/{len(res)}")
