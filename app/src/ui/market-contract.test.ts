import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

test("전역 스타일시트는 기본 레이아웃 계약과 역할별 강조색을 유지한다", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /box-sizing:\s*border-box/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css.toLowerCase(), /--color-coral:\s*#f2584a/);
  assert.match(css.toLowerCase(), /--color-navy:\s*#1b3a8c/);
  assert.match(css.toLowerCase(), /--color-yellow:\s*#f6d74a/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /max-width:\s*480px/);
  assert.match(css, /\.home-header\s+\.wordmark\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.chip\s*\{[^}]*min-height:\s*44px/);
});

test("링크를 받은 누구나 닉네임만으로 시작하고, 닉네임은 식별에 쓰지 않는다", () => {
  const session = read("src/lib/session.ts");
  assert.match(session, /randomBytes\(/);
  assert.match(session, /timingSafeEqual/);
  assert.doesNotMatch(session, /invites/);
  const api = read("src/app/api/session/route.ts");
  assert.match(api, /createUser\(nickname\)/);
  assert.doesNotMatch(api, /where\(eq\(users\.nickname/);
  const login = read("src/app/login/page.tsx");
  assert.match(login, /사기 전에, 써보니/);
  assert.match(login, /결제와 배송은 일어나지 않아요/);
  assert.match(login, /JSON\.stringify\(\{ nickname \}\)/);
  assert.match(login, /disabled=\{pending\}/);
  assert.doesNotMatch(login, /초대 코드/);
});

test("홈은 사진 중심 피드와 검색 결과를 실제 데이터로만 그린다", () => {
  const source = read("src/app/page.tsx");
  assert.match(source, /ProductCard/);
  assert.match(source, /ProductRow/);
  assert.match(source, /방금 올라온 중고/);
  assert.match(source, /demandLabel/);
  assert.doesNotMatch(source, /관심\s*12|조회\s*243|신뢰도\s*98|매너온도/);
});

test("사진이 없을 때 일러스트는 실제 사진이 아니라고 밝힌다", () => {
  const source = read("src/components/ProductIllustration.tsx");
  assert.match(source, /상품 사진 준비 중/);
});

test("찜 화면은 로그인과 실제 ACTIVE 상품 조건을 확인한다", () => {
  const source = read("src/app/wishlist/page.tsx");
  assert.match(source, /getCurrentUserId/);
  assert.match(source, /wishlists\.userId/);
  assert.match(source, /listCards/);
  assert.match(read("src/lib/queries.ts"), /eq\(listings\.status, "ACTIVE"\)/);
});

test("상세의 구매·써보기 버튼은 의향만 기록하고 거래를 시작하지 않는다", () => {
  const source = read("src/components/IntentActionBar.tsx");
  assert.match(source, /사고 싶어요/);
  assert.match(source, /써보고 싶어요/);
  assert.match(source, /fetch\("\/api\/intents"/);
  assert.equal((source.match(/fetch\(/g) ?? []).length, 1);
  assert.doesNotMatch(source, /결제하기|대여료|체험료|신청하기/);
  const api = read("src/app/api/intents/route.ts");
  assert.match(api, /CLICK_TRY_WANT/);
  assert.doesNotMatch(api, /insert\(listings\)|trialEnabled/);
});

test("상품 등록은 써보기를 항상 비활성으로 저장한다", () => {
  const api = read("src/app/api/listings/route.ts");
  assert.match(api, /trialEnabled: false/);
  assert.doesNotMatch(api, /trialEnabled: (body|true)/);
});

test("상세 찜 버튼은 좁은 행동 바에서도 한 글자 아이콘과 접근 가능한 이름을 쓴다", () => {
  const source = read("src/app/listings/[id]/WishlistButton.tsx");
  assert.match(source, /className="wishlist-button"/);
  assert.match(source, /aria-label=\{wished \? "찜 해제" : "찜하기"\}/);
  assert.doesNotMatch(source, /style=\{/);
});
