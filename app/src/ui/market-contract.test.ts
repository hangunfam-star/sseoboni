import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
  const login = read("src/app/login/LoginForm.tsx"); // 화면 본문(page.tsx는 카카오 상태만 넘기는 서버 쪽)
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
  assert.match(source, /써보고 사는 상품/);
  assert.match(source, /일반 중고/);
  assert.match(source, /section\(true/);
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

test("상세의 구매·써보기 버튼은 의향을 기록하고, 거래가 열리고 판매자 계좌가 있을 때만 신청 시트를 연다", () => {
  const source = read("src/components/IntentActionBar.tsx");
  assert.match(source, /사고 싶어요/);
  assert.match(source, /써보고 싶어요/);
  assert.match(source, /fetch\("\/api\/intents"/);
  assert.match(source, /const canTrade = trade\.open && trade\.accountReady/);
  assert.doesNotMatch(source, /card|카드번호|비밀번호/i);
  const api = read("src/app/api/intents/route.ts");
  assert.match(api, /CLICK_TRY_WANT/);
  assert.doesNotMatch(api, /insert\(listings\)|trialEnabled/);
});

test("거래는 운영자가 열기 전까지 닫혀 있고, 써보니는 돈을 받지 않는다(구매자→판매자 직접 입금)", () => {
  const rules = read("src/ui/trade-rules.ts");
  assert.match(rules, /tradeOpen: false/);
  const lib = read("src/lib/orders.ts");
  assert.match(lib, /if \(!settings\.tradeOpen\) throw new TradeError/);
  assert.match(lib, /inArray\(orders\.status, list\)/); // 조건부 상태 전환(중복 처리 방지)
  assert.match(lib, /onConflictDoNothing/);                // 경험치 한 번만
  assert.match(lib, /if \(disputeOpen\(o\.id\)\) continue/); // 분쟁 중 자동 처리 멈춤
  assert.doesNotMatch(lib, /pg|payment_gateway|카드/i);
  const sheet = read("src/components/OrderSheet.tsx");
  assert.match(sheet, /판매자 계좌로 직접/);
  const crypto = read("src/lib/crypto-box.ts");
  assert.match(crypto, /aes-256-gcm/);
  const view = read("src/app/orders/[id]/page.tsx");
  assert.match(view, /써보니는 돈을 받거나 보관하지 않아요/);
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

test("상품 수정·사진 삭제는 판매자 본인만 할 수 있다", () => {
  const api = read("src/app/api/listings/[id]/route.ts");
  assert.match(api, /listing\.sellerId !== userId/);
  assert.match(api, /SELLER_LISTING_EDITED/);
  assert.doesNotMatch(api, /trialEnabled/);
  const photos = read("src/app/api/listings/[id]/photos/route.ts");
  assert.equal((photos.match(/listing\.sellerId !== userId/g) ?? []).length, 2);
  const edit = read("src/app/listings/[id]/edit/page.tsx");
  assert.match(edit, /d\.isOwner/);
});

test("직접 입력 모델은 판매·찾는 상품이 같은 규칙으로 묶인다", () => {
  const models = read("src/lib/models.ts");
  assert.match(models, /lower\(trim\(/);
  assert.match(read("src/app/api/listings/route.ts"), /resolveCustomModel/);
  assert.match(read("src/app/api/demand-intents/route.ts"), /resolveCustomModel/);
});

test("의견 보내기는 연락처를 받지 않고 하루 횟수를 제한한다", () => {
  const api = read("src/app/api/feedback/route.ts");
  assert.match(api, /FEEDBACK_DAILY_MAX/);
  assert.doesNotMatch(api, /phone|email|연락처를 받/i);
  assert.doesNotMatch(read("src/app/feedback/page.tsx"), /type="tel"|type="email"/);
});

test("운영자 결과·CSV는 운영자 쿠키가 있어야 보이고, CSV는 수식 실행을 막는다", () => {
  const page = read("src/app/admin/page.tsx");
  assert.match(page, /await isAdmin\(\)/);
  assert.match(page, /판정 보류/);
  const csv = read("src/app/api/admin/export/route.ts");
  assert.match(csv, /await isAdmin\(\)/);
  assert.ok(csv.includes("/^[\\s\\x00-\\x1f]*[=+\\-@]/"));
  const admin = read("src/lib/admin.ts");
  assert.match(admin, /timingSafeEqual/);
  assert.match(admin, /httpOnly: true/);
});

test("써보기 비용은 판매자 조건으로만 계산하고, 제안·승인은 결제 없이 기록만 한다", () => {
  const api = read("src/app/api/trial-cost/route.ts");
  assert.match(api, /getTrialTerms/);
  assert.match(api, /computeTrialCost\(listing\.price/);
  assert.doesNotMatch(api, /trialEnabled|payment/i);
  const proposals = read("src/app/api/proposals/route.ts");
  assert.match(proposals, /listing\.sellerId === userId/);
  assert.match(proposals, /PENDING_EXISTS/);
  assert.doesNotMatch(proposals, /trialEnabled|payment/i);
  const decide = read("src/app/api/proposals/[id]/route.ts");
  assert.match(decide, /action === "CANCEL" && !isBuyer/);
  assert.match(decide, /status\} = 'PENDING'/);
  const sheet = read("src/components/ProposalSheet.tsx");
  assert.match(sheet, /제안은 약속일 뿐이고/);
  assert.match(sheet, /연락처는 적지 마세요/);
  assert.doesNotMatch(read("src/app/api/listings/route.ts"), /trialEnabled: true/);
  assert.equal(existsSync(resolve(process.cwd(), "src/app/api/admin/pricing/route.ts")), false);
});

test("채팅은 참여자만 읽고 쓰며, 연락처를 막고, 시장검증 기록에 본문을 남기지 않는다", () => {
  const lib = read("src/lib/chat.ts");
  assert.match(lib, /thread\.buyerId === userId/);
  assert.match(lib, /thread\.sellerId === userId/);
  const api = read("src/app/api/chats/[id]/route.ts");
  assert.match(api, /await threadFor\(id, userId\)/);
  assert.match(api, /findContactInfo\(text\)/);
  assert.match(api, /CHAT_RATE/);
  assert.doesNotMatch(api, /metadata: JSON\.stringify\(\{[^}]*body/);
  const start = read("src/app/api/chats/route.ts");
  assert.match(start, /listing\.sellerId === userId/);
  assert.match(read("src/app/admin/page.tsx"), /채팅 내용은 운영자 화면에 보이지 않아요/);
});
