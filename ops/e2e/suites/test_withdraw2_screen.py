# -*- coding: utf-8 -*-
# 탈퇴 2단계(docs/review/WITHDRAW_PLAN_v12.md) 화면 시험: T21b(같은 브라우저 사진 캐시), T22(상대방 주문 화면·목록), T22b(스냅숏 비개인 항목), T28(상대방 화면 오류 없음).
# 서버: WITHDRAW=1 bash ops/e2e/run_isolated.sh (보관 키 포함). 사용: python test_withdraw2_screen.py <복사 DB> <캡처 폴더> <pc|m>
# 점검마다 탈퇴 전 반대 결과를 먼저 확인한다(84절).
import sys, sqlite3, urllib.request, urllib.parse, time, json, os, secrets, io
from datetime import datetime, timezone, timedelta
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
B, F, DB, OUT, MODE = "http://localhost:3200", "http://localhost:3299", sys.argv[1], sys.argv[2], sys.argv[3]
IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
res = []
def check(n, ok, d=""): res.append(bool(ok)); print("PASS" if ok else "FAIL", n, "" if ok else d, flush=True)
def fake(**kw): urllib.request.urlopen(F + "/_set?" + urllib.parse.urlencode(kw)).read()
def q(sql, *a):
    c = sqlite3.connect(DB); r = c.execute(sql, a).fetchall(); c.close(); return r
def x(sql, *a):
    c = sqlite3.connect(DB); c.execute(sql, a); c.commit(); c.close()
def ago(hours): return (datetime.now(timezone.utc) - timedelta(hours=hours)).strftime("%Y-%m-%d %H:%M:%S")
KID = int(time.time()) % 100000 + 700000 + (0 if MODE == "pc" else 300)
TAG = "s2" + MODE
VP = {"viewport": {"width": 1280, "height": 900}} if MODE != "m" else {"viewport": {"width": 375, "height": 812}, "is_mobile": True, "has_touch": True, "user_agent": IPHONE}
MODEL = q("select id from product_models where model_name like 'MacBook Air M2%'")[0][0]

def png_bytes():
    # 10x10 단색 PNG(외부 파일 없이)
    import zlib, struct
    raw = b"".join(b"\x00" + b"\x30\x90\xc0" * 10 for _ in range(10))
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 10, 10, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def login(kid, nick):
        c = b.new_context(**VP); c.add_init_script("try{sessionStorage.setItem('sb_splash','1');localStorage.setItem('sb_install', JSON.stringify({until: Date.now()+9e9, forced: true}))}catch(e){}")
        pg = c.new_page(); pg.set_default_timeout(90000); pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
        fake(id=kid, nick=nick)
        pg.goto(B + "/login", wait_until="load"); pg.get_by_role("link", name="카카오로 로그인").click()
        pg.wait_for_url(lambda u: "step=kakao" in u or u.rstrip("/") == B)
        if "step=kakao" in pg.url:
            pg.get_by_role("button", name="카카오 닉네임으로 시작하기").click(); pg.wait_for_url(B + "/")
        uid = next(k["value"].split(".")[0] for k in c.cookies() if k["name"] == "sseoboni_sid")
        return c, pg, uid
    sc, sp, sid = login(KID, f"판매{TAG}{KID % 1000}")
    bc, bp, bid = login(KID + 1, f"구매{TAG}{KID % 1000}")
    d = {"modelId": MODEL, "title": f"사진 탈퇴 시험 {TAG}", "price": 300000, "conditionGrade": "A", "description": "탈퇴 2단계 화면 시험", "tryWillingness": "NO", "components": ["본체"], "trialTerms": None}
    lid = sc.request.post(B + "/api/listings", data=d).json()["listing"]["id"]
    up = sc.request.post(B + f"/api/listings/{lid}/photos", multipart={"photo": {"name": "a.png", "mimeType": "image/png", "buffer": png_bytes()}})
    check(f"{TAG} 준비: 사진 올리기 201", up.status == 201, up.status)
    purl = up.json()["photos"][0]["url"]; fname = purl.split("/")[-1].split("?")[0]
    # 끝난 거래(분쟁 기간 7일 지남) — 상대방 주문 화면 시험용
    oid = "wd2_" + secrets.token_hex(6)
    snap = {"title": f"사진 탈퇴 시험 {TAG}", "price": 300000, "conditionGrade": "A", "description": "탈퇴 2단계 화면 시험", "components": ["본체"], "photo": fname, "brand": None, "modelName": "MacBook Air M2", "modelId": MODEL, "category": None, "conditionNote": None, "checks": []}
    x("insert into orders (id, listing_id, buyer_id, seller_id, kind, status, snapshot, price, deposit_name, ship_enc, completed_at) values (?,?,?,?,?,?,?,?,?,?,?)",
      oid, lid, bid, sid, "BUY", "PURCHASED", json.dumps(snap, ensure_ascii=False), 300000, "구매1234", "", ago(24 * 10))
    x("update listings set status='SOLD' where id=?", lid)

    # T21b: 탈퇴 전 — 같은 브라우저에서 200 → 같은 ETag로 304
    r1 = bc.request.get(B + purl); et = r1.headers.get("etag")
    r2 = bc.request.get(B + purl, headers={"If-None-Match": et or ""})
    check(f"{TAG} T21b 탈퇴 전 사진 200·재요청 304·no-cache", r1.status == 200 and r2.status == 304 and "no-cache" in (r1.headers.get("cache-control") or ""), (r1.status, r2.status, r1.headers.get("cache-control")))
    bp.goto(B + f"/orders/{oid}", wait_until="networkidle")
    img_before = bp.evaluate("(f)=>[...document.images].filter(i=>i.src.includes(f)).map(i=>i.naturalWidth)", fname)
    check(f"{TAG} T22 탈퇴 전 주문 화면에 사진이 보임", len(img_before) > 0 and all(w > 0 for w in img_before), img_before)
    # Codex 1차 지적 3: 사진이 Next 이미지 최적화 주소(/_next/image, 캐시 남음)를 거치지 않고 원본 API를 직접 부른다
    srcs = bp.evaluate("()=>[...document.images].map(i=>i.currentSrc||i.src)")
    check(f"{TAG} 사진 주소에 /_next/image 없음(원본 API 직접)", not any("/_next/image" in s for s in srcs) and any("/api/photos/" in s for s in srcs), srcs[:4])
    bp.screenshot(path=os.path.join(OUT, f"w2_{MODE}_order_before.png"), full_page=True)
    snap_before = json.loads(q("select snapshot from orders where id=?", oid)[0][0])

    # 판매자 탈퇴(화면에서)
    sp.goto(B + "/me/account", wait_until="networkidle")
    for _ in range(5):
        sp.get_by_role("button", name="탈퇴 안내 보기").click()
        try: sp.get_by_placeholder("여기에 직접 입력").wait_for(timeout=8000); break
        except Exception: pass
    sp.get_by_placeholder("여기에 직접 입력").fill("화면 시험")
    sp.get_by_role("button", name="탈퇴하기").click(); sp.wait_for_url(lambda u: "/withdrawn" in u, timeout=120000)
    st = q("select stage from withdrawals where user_id=?", sid)
    check(f"{TAG} 탈퇴 뒤 보관 이동 끝(RETAINED)", st and st[0][0] == "RETAINED", st)

    # T21b: 탈퇴 뒤 — 같은 ETag여도 404, 브라우저 화면에서도 사진이 안 보임
    r3 = bc.request.get(B + purl, headers={"If-None-Match": et or ""})
    check(f"{TAG} T21b 탈퇴 뒤 같은 ETag 요청 404(304 아님)", r3.status == 404, r3.status)
    bp.reload(wait_until="networkidle")
    img_after = bp.evaluate("(f)=>[...document.images].filter(i=>i.src.includes(f)).map(i=>i.naturalWidth)", fname)
    check(f"{TAG} T21b 새로 고침 뒤 탈퇴자 사진이 보이지 않음", all(w == 0 for w in img_after), img_after)
    bp.screenshot(path=os.path.join(OUT, f"w2_{MODE}_order_after.png"), full_page=True)
    body = bp.inner_text("body")
    check(f"{TAG} T22 상대방 주문 화면이 열림(탈퇴한 판매자 표시)", "탈퇴한" in body and "사진 탈퇴 시험" not in body, body[:200])
    snap_after = json.loads(q("select snapshot from orders where id=?", oid)[0][0])
    keep = ["price", "conditionGrade", "components", "modelName", "modelId", "category"]
    check(f"{TAG} T22b 스냅숏 비개인 항목 그대로·원문 칸 바뀜", all(snap_before.get(k) == snap_after.get(k) for k in keep) and snap_after.get("title") != snap_before["title"] and not snap_after.get("photo"), {k: (snap_before.get(k), snap_after.get(k)) for k in keep + ["title", "photo"]})
    bp.goto(B + "/orders", wait_until="networkidle"); bp.screenshot(path=os.path.join(OUT, f"w2_{MODE}_orders.png"), full_page=True)
    check(f"{TAG} T28 상대방 거래 목록이 열림", bp.locator("main").count() > 0)
    bp.goto(B + "/", wait_until="networkidle"); bp.screenshot(path=os.path.join(OUT, f"w2_{MODE}_home.png"))
    check(f"{TAG} T28 첫 화면에 탈퇴자 상품 없음", "사진 탈퇴 시험" not in bp.inner_text("body"))
    check(f"{TAG} T28 화면 스크립트 오류 0건", len(errs) == 0, errs[:3])
    b.close()
print(f"SUMMARY {TAG} pass={sum(res)} fail={len(res) - sum(res)}")
sys.exit(0 if all(res) else 1)
