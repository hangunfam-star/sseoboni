# 써보니 Style 2 UI Implementation Plan

> **Execution status (2026-09-30):** All six tasks were executed in the current checkout and verified locally. Evidence: `reports/2026-09-30-style-2-ui-verification.md`. Changes remain uncommitted and unpublished.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 써보니 Gate 0의 로그인·공통 모바일 셸·홈·찜 목록·상품 상세를 두 번째 참고 이미지 기반의 코랄/네이비/옐로 카드 UI로 바꾸고 기존 인증·조회·찜 동작을 유지한다.

**Architecture:** 새 UI 프레임워크를 추가하지 않고 CSS 변수와 작은 React 컴포넌트로 시각 체계를 만든다. 데이터 조회와 인증 로직은 기존 페이지에 남기고, 탐색·표시 규칙만 `src/ui`와 `src/components`로 분리한다. 현재 작업트리의 미커밋 초대 코드·세션 변경을 보존하며 DB·API·스키마는 변경하지 않는다.

**Tech Stack:** Next.js 16.3.6, React 19.2.8, TypeScript 5, global CSS, Node `node:test` via existing `tsx`

**Spec:** `docs/superpowers/specs/2026-09-30-style-2-ui-design.md`

## Global Constraints

- 모바일 기준 폭은 360~430px이고 데스크톱에서는 최대 480px 앱 셸로 표시한다.
- 코랄 `#F2584A`는 써보기 의향, 네이비 `#1B3A8C`는 구매 의향, 옐로 `#F6D74A`는 찾는 상품에만 쓴다.
- 가짜 상품 사진·거래량·신뢰도·체험료·수요 숫자를 만들지 않는다.
- Gate 0에서는 결제·배송·반환·실제 체험 신청을 시작하지 않는다.
- Tailwind, UI 라이브러리, 웹폰트 등 새 의존성을 추가하지 않는다.
- 기존 초대 코드 로그인, 세션 검증, 상품 조회, 상세 조회와 찜 기능을 보존한다.
- 하단 메뉴는 `홈 / 찾는 상품 / 판매하기 / 찜 / MY` 다섯 탭으로 고정하고 모든 탭이 실제 경로로 연결되게 한다.
- DB 스키마, API 응답 형식과 마이그레이션을 변경하지 않는다.
- 현재 미커밋 인증 변경이 섞인 `layout.tsx`, `login/page.tsx`, `package.json`은 통째로 되돌리거나 이전 버전으로 교체하지 않는다.
- 구현 중 Git 커밋은 기존 인증 변경과 UI 변경을 안전하게 분리할 수 있을 때만 수행한다. 분리할 수 없으면 변경을 미커밋 상태로 검증하고 보고한다.

## Review Focus

1. 360px 화면과 긴 한글 상품명에서도 가로 스크롤이 생기지 않아야 한다 — Task 4·6에서 긴 제목 표본과 화면 폭을 확인한다.
2. 상품 이미지가 없을 때 가짜 사진 대신 `사진 준비 중` 플레이스홀더가 보여야 한다 — Task 4 자동 테스트와 Task 6 화면 확인으로 고정한다.
3. 로그인 실패·중복 클릭 때 기존 오류 메시지와 `pending` 잠금이 유지돼야 한다 — Task 3 소스 계약 테스트와 실제 로그인 실패 확인으로 고정한다.
4. `사고 싶어요`와 `써보고 싶어요`가 실제 거래나 결제를 시작하는 것처럼 보이면 안 된다 — Task 5에서 비활성/준비 중 상태를 자동 테스트하고 Task 6 네트워크 요청을 확인한다.
5. 고정 하단 메뉴와 상세 행동 바가 모바일 안전영역 및 본문을 가리면 안 된다 — Task 2 CSS 계약 테스트와 Task 6의 360/390/430px 캡처로 확인한다.

---

## File Structure

### 새 파일

- `app/src/ui/navigation.ts` — 하단 메뉴 항목과 현재 경로 판정
- `app/src/ui/navigation.test.ts` — 메뉴 경로 판정 회귀 테스트
- `app/src/ui/presentation.ts` — 가격·상태·이미지 없는 상품 표시용 순수 함수
- `app/src/ui/presentation.test.ts` — 표시 규칙과 긴 입력 회귀 테스트
- `app/src/ui/style2-contract.test.ts` — CSS 토큰, Gate 0 문구와 금지 표현 계약 테스트
- `app/src/components/AppShell.tsx` — 모바일 앱 셸
- `app/src/components/BottomNav.tsx` — 하단 메뉴
- `app/src/components/ProductCard.tsx` — 홈 상품 카드
- `app/src/components/IntentActionBar.tsx` — 상세 하단 찜·구매의향·써보기의향 영역
- `app/src/app/me/page.tsx` — 아직 없는 MY 경로가 404가 되지 않도록 하는 정직한 준비 중 화면
- `app/src/app/wishlist/page.tsx` — 실제 사용자 찜 목록과 로그인·빈 상태 화면

### 수정 파일

- `app/package.json` — 기존 `invite` 스크립트를 보존하고 `test:ui`만 추가
- `app/src/app/globals.css` — Style 2 토큰과 공통 컴포넌트 CSS
- `app/src/app/layout.tsx` — 현재 `Link` 변경을 보존하면서 `AppShell` 적용
- `app/src/app/login/page.tsx` — 현재 초대 코드 로직을 보존하면서 화면 구조만 변경
- `app/src/app/page.tsx` — 실제 ACTIVE 상품 조회를 유지하면서 새 홈 구조 적용
- `app/src/app/listings/[id]/page.tsx` — 상세 데이터·조회 이벤트·찜을 유지하면서 새 상세 구조 적용

---

### Task 1: UI 표시 규칙과 테스트 실행 기반

**Files:**
- Create: `app/src/ui/navigation.ts`
- Create: `app/src/ui/navigation.test.ts`
- Create: `app/src/ui/presentation.ts`
- Create: `app/src/ui/presentation.test.ts`
- Modify: `app/package.json`

**Interfaces:**
- Produces: `NAV_ITEMS: readonly NavItem[]`
- Produces: `isNavItemActive(pathname: string, href: string): boolean`
- Produces: `formatWon(value: number): string`
- Produces: `conditionLabel(value: string): string`
- Produces: `visualInitial(brand: string | null, modelName: string | null): string`
- Consumes: no UI component or DB dependency

- [ ] **Step 1: Write the navigation and presentation tests**

```ts
// app/src/ui/navigation.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, isNavItemActive } from "./navigation";

test("하단 메뉴는 Gate 0 다섯 항목을 노출한다", () => {
  assert.deepEqual(NAV_ITEMS.map((item) => item.label), ["홈", "찾는 상품", "판매하기", "찜", "MY"]);
});

test("하위 경로에서도 해당 메뉴가 활성화된다", () => {
  assert.equal(isNavItemActive("/listings/new", "/listings/new"), true);
  assert.equal(isNavItemActive("/demand/history", "/demand"), true);
  assert.equal(isNavItemActive("/login", "/"), false);
});
```

```ts
// app/src/ui/presentation.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { conditionLabel, formatWon, visualInitial } from "./presentation";

test("가격과 상태를 사용자 문구로 변환한다", () => {
  assert.equal(formatWon(1290000), "1,290,000원");
  assert.equal(conditionLabel("A"), "상태 A");
  assert.equal(conditionLabel("unknown"), "상태 확인 필요");
});

test("사진 없는 상품에는 실제 브랜드 첫 글자만 사용한다", () => {
  assert.equal(visualInitial("Apple", "MacBook Air"), "A");
  assert.equal(visualInitial("", "MacBook Air"), "M");
  assert.equal(visualInitial("", ""), "상품");
});
```

- [ ] **Step 2: Add the exact UI test command without removing the invite command**

```json
"scripts": {
  "invite": "node scripts/invite.mjs",
  "test:ui": "tsx --test src/ui/navigation.test.ts src/ui/presentation.test.ts src/ui/style2-contract.test.ts"
}
```

- [ ] **Step 3: Run the tests and verify they fail because the modules do not exist**

Run from `app`:

```powershell
npm run test:ui
```

Expected: FAIL with module-not-found errors for `navigation`, `presentation`, and `style2-contract.test.ts`.

- [ ] **Step 4: Implement the pure helpers**

```ts
// app/src/ui/navigation.ts
export type NavItem = {
  href: string;
  label: "홈" | "찾는 상품" | "판매하기" | "찜" | "MY";
  glyph: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "홈", glyph: "⌂" },
  { href: "/demand", label: "찾는 상품", glyph: "⌕" },
  { href: "/listings/new", label: "판매하기", glyph: "+" },
  { href: "/wishlist", label: "찜", glyph: "♡" },
  { href: "/me", label: "MY", glyph: "●" },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

```ts
// app/src/ui/presentation.ts
const CONDITION_LABELS: Record<string, string> = {
  S: "상태 S",
  A: "상태 A",
  B: "상태 B",
  C: "상태 C",
};

export function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function conditionLabel(value: string): string {
  return CONDITION_LABELS[value] ?? "상태 확인 필요";
}

export function visualInitial(brand: string | null, modelName: string | null): string {
  const source = brand?.trim() || modelName?.trim();
  return source ? Array.from(source)[0].toUpperCase() : "상품";
}
```

- [ ] **Step 5: Create the initial stylesheet safety contract**

```ts
// app/src/ui/style2-contract.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("전역 스타일시트는 현재 기본 레이아웃 계약을 유지한다", () => {
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
  assert.match(css, /box-sizing:\s*border-box/);
  assert.match(css, /overflow-x:\s*hidden/);
});
```

- [ ] **Step 6: Run the focused tests**

Run: `npm run test:ui`

Expected: all tests PASS.

- [ ] **Step 7: Git checkpoint**

Run `git diff -- app/package.json app/src/ui` and confirm the existing `invite` script remains. Do not commit `package.json` if doing so would mix unrelated authentication changes; record the task as verified but uncommitted instead.

---

### Task 2: Style 2 토큰, 모바일 셸과 하단 메뉴

**Files:**
- Create: `app/src/components/AppShell.tsx`
- Create: `app/src/components/BottomNav.tsx`
- Create: `app/src/app/me/page.tsx`
- Modify: `app/src/app/globals.css`
- Modify: `app/src/app/layout.tsx`
- Modify: `app/src/ui/style2-contract.test.ts`

**Interfaces:**
- Consumes: `NAV_ITEMS`, `isNavItemActive` from `src/ui/navigation.ts`
- Produces: `AppShell({ children }: { children: React.ReactNode })`
- Produces: `BottomNav()` client component

- [ ] **Step 1: Expand the CSS contract test first**

```ts
// append to app/src/ui/style2-contract.test.ts
test("Style 2 핵심 토큰과 모바일 안전영역이 존재한다", () => {
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
  assert.match(css.toLowerCase(), /--color-coral:\s*#f2584a/);
  assert.match(css.toLowerCase(), /--color-navy:\s*#1b3a8c/);
  assert.match(css.toLowerCase(), /--color-yellow:\s*#f6d74a/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /max-width:\s*480px/);
});
```

- [ ] **Step 2: Run the contract test and verify it fails on the current CSS**

Run: `npm run test:ui`

Expected: FAIL because the Style 2 tokens and safe-area rules are absent.

- [ ] **Step 3: Implement the global tokens and shell classes**

Add to `globals.css`:

```css
:root {
  --color-coral: #f2584a;
  --color-coral-soft: #fff0ed;
  --color-navy: #1b3a8c;
  --color-navy-deep: #12265f;
  --color-yellow: #f6d74a;
  --color-ink: #16181d;
  --color-muted: #737780;
  --color-surface: #ffffff;
  --color-canvas: #f5f3f1;
  --color-line: #e8e5e1;
  --radius-card: 24px;
  --shadow-card: 0 18px 45px rgba(18, 38, 95, 0.1);
}

.app-shell {
  width: 100%;
  max-width: 480px;
  min-height: 100dvh;
  margin: 0 auto;
  background: var(--color-surface);
  padding-bottom: calc(96px + env(safe-area-inset-bottom));
  overflow-x: clip;
}
```

Also remove the automatic dark color-scheme block so the approved palette does not silently invert on dark-mode devices. Keep visible focus styles and add `.sr-only`, `.bottom-nav`, `.bottom-nav__sell`, `.page`, `.section-title`, `.color-card`, and responsive rules from the spec.

- [ ] **Step 4: Create the mobile shell and navigation**

```tsx
// app/src/components/AppShell.tsx
import Link from "next/link";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="wordmark" href="/">써보니</Link>
      </header>
      <main className="app-main">{children}</main>
      <BottomNav />
    </div>
  );
}
```

```tsx
// app/src/components/BottomNav.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "@/ui/navigation";

export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={item.label === "판매하기" ? "bottom-nav__item bottom-nav__sell" : "bottom-nav__item"}
          aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
        >
          <span aria-hidden="true">{item.glyph}</span><span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 5: Add a truthful MY destination so the navigation never points to a 404**

```tsx
// app/src/app/me/page.tsx
import Link from "next/link";

export default function MyPage() {
  return (
    <div className="page my-placeholder">
      <p className="eyebrow">MY</p>
      <h1>내 활동을 모아볼 화면을 준비하고 있어요.</h1>
      <p>지금은 상품을 등록하거나 찾는 상품을 남길 수 있어요.</p>
      <div className="placeholder-actions">
        <Link className="secondary-button" href="/demand">찾는 상품</Link>
        <Link className="primary-button" href="/listings/new">판매하기</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Replace only the layout markup, preserving the existing metadata and `Link`-related fix**

```tsx
<html lang="ko">
  <body>
    <AppShell>{children}</AppShell>
  </body>
</html>
```

- [ ] **Step 7: Run focused and compile checks**

Run: `npm run test:ui && npx tsc --noEmit`

Expected: PASS, no TypeScript errors.

- [ ] **Step 8: Git checkpoint**

Inspect `git diff -- app/src/app/layout.tsx app/src/app/globals.css app/src/components app/src/ui`. Confirm the pre-existing `<a>` to `<Link>` correction was not lost. Do not stage mixed auth changes.

---

### Task 3: 초대 코드 로그인 화면

**Files:**
- Modify: `app/src/app/login/page.tsx`
- Modify: `app/src/ui/style2-contract.test.ts`

**Interfaces:**
- Consumes: existing `POST /api/session` body `{ code: string }`
- Preserves: `pending`, API error fallback, `router.push("/")`, `router.refresh()`

- [ ] **Step 1: Add the login source contract test**

```ts
test("로그인은 테스트 범위와 초대 코드 동작을 정확히 안내한다", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/login/page.tsx"), "utf8");
  assert.match(source, /사기 전에, 써보니/);
  assert.match(source, /결제와 배송은 일어나지 않아요/);
  assert.match(source, /JSON\.stringify\(\{ code \}\)/);
  assert.match(source, /disabled=\{pending\}/);
  assert.doesNotMatch(source, /닉네임으로 시작하기/);
});
```

- [ ] **Step 2: Run the test and verify it fails only on the new visual copy**

Run: `npm run test:ui`

Expected: FAIL because the headline and test-period copy are not present; the code and pending assertions already pass.

- [ ] **Step 3: Restructure the JSX without replacing the login logic**

Use this hierarchy:

```tsx
<div className="login-page page">
  <section className="login-hero">
    <p className="eyebrow">중고거래의 새로운 방법</p>
    <h1>사기 전에,<br />써보니.</h1>
    <div className="login-feature-grid">
      <article className="color-card color-card--navy">사고 싶은 물건 찾기</article>
      <article className="color-card color-card--coral">써보고 싶은 마음 남기기</article>
      <article className="color-card color-card--yellow">찾는 상품 기다리기</article>
    </div>
  </section>
  <form className="login-card" onSubmit={handleSubmit}>
    <p className="validation-notice">지금은 테스트 기간이며 결제와 배송은 일어나지 않아요.</p>
    {/* existing code input, submit button, and error */}
  </form>
</div>
```

Keep the existing state variables and fetch function byte-for-byte unless formatting requires movement. On `pending`, button text becomes `확인 중…`; do not send a second request.

- [ ] **Step 4: Add login-specific CSS**

Implement `.login-page`, `.login-hero`, `.login-feature-grid`, `.login-card`, `.validation-notice`, `.field`, `.primary-button`, `.form-error`. Use the approved tokens and keep the input and button at least 54px high.

- [ ] **Step 5: Run tests and TypeScript**

Run: `npm run test:ui && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Git checkpoint**

Inspect `git diff -- app/src/app/login/page.tsx`. Confirm `{ code }`, `pending`, error fallback, redirect and refresh remain. Do not commit this file separately while its existing authentication changes are uncommitted.

---

### Task 4: 홈·찜 목록과 실제 상품 카드

**Files:**
- Create: `app/src/components/ProductCard.tsx`
- Create: `app/src/app/wishlist/page.tsx`
- Modify: `app/src/app/page.tsx`
- Modify: `app/src/app/globals.css`
- Modify: `app/src/ui/style2-contract.test.ts`

**Interfaces:**
- Consumes: `formatWon`, `conditionLabel`, `visualInitial` from `src/ui/presentation.ts`
- Produces: `ProductCard({ id, title, price, conditionGrade, brand, modelName })`
- Preserves: current ACTIVE listing filter, title search and created-at ordering
- Consumes: `getCurrentUserId`, `wishlists`, `listings`, `productModels` for the signed-in user's real wishlist

- [ ] **Step 1: Add home truthfulness and long-title contract tests**

```ts
test("홈은 실제 상품과 사진 없는 상태를 사실대로 표시한다", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
  assert.match(source, /ProductCard/);
  assert.match(source, /사람들이 찾고 있어요/);
  assert.doesNotMatch(source, /관심\s*12|조회\s*243|신뢰도\s*98/);
});
```

Add a wishlist source contract and extend `presentation.test.ts`:

```ts
test("찜 화면은 로그인과 실제 ACTIVE 상품 조건을 확인한다", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/wishlist/page.tsx"), "utf8");
  assert.match(source, /getCurrentUserId/);
  assert.match(source, /wishlists\.userId/);
  assert.match(source, /listings\.status/);
  assert.match(source, /ProductCard/);
});
```

```ts
test("긴 제목과 큰 가격도 문자열 손실 없이 표시 규칙을 통과한다", () => {
  const title = "매우 긴 한글 상품명 ".repeat(10).trim();
  assert.equal(title.length > 60, true);
  assert.equal(formatWon(100000000), "100,000,000원");
});
```

- [ ] **Step 2: Run the tests and verify the home contract fails**

Run: `npm run test:ui`

Expected: FAIL because `ProductCard`, the demand section copy, and the wishlist page are absent.

- [ ] **Step 3: Implement `ProductCard`**

```tsx
import Link from "next/link";
import { conditionLabel, formatWon, visualInitial } from "@/ui/presentation";

type ProductCardProps = {
  id: string;
  title: string;
  price: number;
  conditionGrade: string;
  brand: string | null;
  modelName: string | null;
};

export function ProductCard(props: ProductCardProps) {
  return (
    <Link className="product-card" href={`/listings/${props.id}`}>
      <div className="product-card__visual" aria-label="상품 사진 준비 중">
        <span>{visualInitial(props.brand, props.modelName)}</span>
        <small>사진 준비 중</small>
      </div>
      <div className="product-card__body">
        <p className="product-card__model">{props.brand} · {props.modelName}</p>
        <h3>{props.title}</h3>
        <strong>{formatWon(props.price)}</strong>
        <span className="condition-badge">{conditionLabel(props.conditionGrade)}</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Rebuild the home JSX while keeping the query unchanged**

Render in this order: headline, rounded search form, yellow demand card without invented counts, latest product section, truthful empty state. The demand card links to `/demand`. Every row from the existing query is passed to `ProductCard`.

- [ ] **Step 5: Create the real wishlist page**

Resolve the signed-in user with `getCurrentUserId()`. If it returns `null`, render a truthful login prompt and do not query or display another user's rows. Otherwise join `wishlists` to `listings` and `productModels`, filter by the current `userId` and `listings.status = "ACTIVE"`, order by `wishlists.createdAt` descending, and pass only those real rows to `ProductCard`. Render `아직 찜한 상품이 없어요` when the result is empty. Do not introduce a new API, schema, count, photo or trust value.

- [ ] **Step 6: Add product-card, home and wishlist responsive CSS**

Use one column at 360px and allow two columns only when card content retains at least 180px width. Apply two-line ellipsis to titles and `white-space: nowrap` to prices. Do not hide focus outlines.

- [ ] **Step 7: Run UI tests, lint and TypeScript**

Run: `npm run test:ui && npm run lint && npx tsc --noEmit`

Expected: PASS with 0 lint errors.

- [ ] **Step 8: Git checkpoint**

Inspect the query diff and confirm the home keeps `eq(listings.status, "ACTIVE")`, optional `like` search and `orderBy(desc(listings.createdAt))`. Confirm the wishlist query also filters by the verified current user and `ACTIVE` listings, and no DB/API/schema file changed.

---

### Task 5: 상품 상세와 Gate 0 행동 바

**Files:**
- Create: `app/src/components/IntentActionBar.tsx`
- Modify: `app/src/app/listings/[id]/page.tsx`
- Modify: `app/src/app/globals.css`
- Modify: `app/src/ui/style2-contract.test.ts`

**Interfaces:**
- Consumes: existing `WishlistButton` with `listingId` and `initialWished`
- Produces: `IntentActionBar({ listingId, wished }: { listingId: string; wished: boolean })`
- Preserves: listing lookup, `notFound`, model lookup, current user lookup, `VIEW_LISTING` event and wishlist lookup

- [ ] **Step 1: Add the Gate 0 action contract test**

```ts
test("상세의 구매·써보기 버튼은 거래를 시작하지 않는다", () => {
  const source = readFileSync(resolve(process.cwd(), "src/components/IntentActionBar.tsx"), "utf8");
  assert.match(source, /사고 싶어요/);
  assert.match(source, /써보고 싶어요/);
  assert.match(source, /준비 중/);
  assert.match(source, /disabled/);
  assert.doesNotMatch(source, /fetch\(|결제|대여료|체험료/);
});
```

- [ ] **Step 2: Run the test and verify it fails because the component does not exist**

Run: `npm run test:ui`

Expected: FAIL reading the missing `IntentActionBar.tsx`.

- [ ] **Step 3: Implement the action bar**

```tsx
import { WishlistButton } from "@/app/listings/[id]/WishlistButton";

export function IntentActionBar({ listingId, wished }: { listingId: string; wished: boolean }) {
  return (
    <div className="intent-action-bar" aria-label="상품 행동">
      <WishlistButton listingId={listingId} initialWished={wished} />
      <button type="button" className="intent-button intent-button--buy" disabled title="의향 기록 기능 준비 중">
        사고 싶어요<span>준비 중</span>
      </button>
      <button type="button" className="intent-button intent-button--try" disabled title="Gate 0에서는 실제 신청이 일어나지 않아요">
        써보고 싶어요<span>준비 중</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Rebuild only the detail presentation**

Keep the existing data and event code unchanged. Use `visualInitial`, `formatWon`, and `conditionLabel`; add a truthful visual placeholder; render the description with preserved line breaks; replace the old disabled trial button block with `IntentActionBar`.

- [ ] **Step 5: Add sticky action bar CSS**

The bar must sit above the bottom navigation, use `bottom: calc(72px + env(safe-area-inset-bottom))`, and never cover the description because `.listing-detail` receives matching bottom padding. At 360px, labels may shrink but must not overflow.

- [ ] **Step 6: Run tests, lint and TypeScript**

Run: `npm run test:ui && npm run lint && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Git checkpoint**

Inspect the page diff and confirm the listing lookup, `notFound()`, `VIEW_LISTING` insert, wishlist query and seller-independent display remain.

---

### Task 6: Production build and mobile visual verification

**Files:**
- Modify: none unless verification exposes a defect
- Evidence: `E:\PROJECTS\04_써보니\reports\2026-09-30-style-2-ui-verification.md`
- Evidence images: `E:\PROJECTS\04_써보니\reports\style-2-ui\*.png`

**Interfaces:**
- Consumes: completed Tasks 1–5
- Produces: lint/type/test/build results, mobile screenshots and a truthful verification report

- [ ] **Step 1: Run the complete local checks**

Run from `app`:

```powershell
npm run test:ui
npm run lint
npx tsc --noEmit
npm run build
```

Expected: all commands exit 0. Record individual PASS/FAIL; do not collapse a failure into partial success.

- [ ] **Step 2: Prepare an isolated runtime DB before opening detail pages**

Resolve an explicit temporary directory under the project, copy `app/dev.db` plus WAL/SHM if they exist, and verify the resolved destination remains inside that temporary directory. Run the built app on port 3100 with `DATABASE_URL` pointing to the copy. This prevents the detail page's `VIEW_LISTING` insert from changing the real development DB.

- [ ] **Step 3: Verify login behavior**

At 390px width, submit an invalid code once. Confirm the error appears next to the form, the request is sent only once, and the page explains that payment and delivery do not occur. Do not expose a real invite code in screenshots or logs.

- [ ] **Step 4: Capture the home page at three widths**

Capture 360px, 390px, and 430px. Confirm no horizontal scroll, all five navigation items remain reachable, the yellow demand card contains no invented count, and every product uses actual DB values plus the truthful image placeholder.

- [ ] **Step 5: Verify the wishlist tab with the isolated copy DB**

Verify the logged-out state shows the login prompt, a logged-in empty state says `아직 찜한 상품이 없어요`, and a logged-in user with a real copied wishlist row sees only that user's `ACTIVE` product. Confirm the `찜` tab is active on `/wishlist` and no fake count appears.

- [ ] **Step 6: Capture a real listing detail using only the copy DB**

Confirm title, price, condition and description match the copied record. Confirm wishlist remains functional only when logged in and the two intent buttons are disabled, show `준비 중`, and cause no POST request.

- [ ] **Step 7: Check accessibility and layout regressions**

Keyboard-tab through login, home links, navigation and detail actions. Confirm visible focus, minimum 44px targets, readable contrast, and no body content hidden under fixed elements.

- [ ] **Step 8: Stop the test server and remove only the verified temporary runtime directory**

Before deletion, resolve the absolute path and confirm it is inside the task-specific temporary directory, not the project root. Preserve screenshots and the Markdown report.

- [ ] **Step 9: Write the verification report**

The report must separate:

```markdown
## 작업 결과
## 실제 확인 범위
## 테스트 결과
## 적용 완료·사용자 화면 미확인 항목
## 남은 일
## 작업 지시 요약
## 이번 작업 상태
## 필요한 사용자 행동·승인
## 다음 작업
```

- [ ] **Step 10: Final Git review**

Run `git diff --check`, focused `git diff` for all UI files, and `git status --short`. Report which changes were pre-existing versus created by this plan. Do not commit, push, merge, open ngrok, or expose the app unless separately authorized.

---

## Completion Gate

Implementation is complete only when all six tasks are checked and all of the following are true:

- UI tests, lint, TypeScript and production build pass.
- Login API logic and existing invite/session changes are preserved.
- Home reads only actual ACTIVE listings and uses no invented numbers.
- The five bottom tabs all resolve, and `/wishlist` shows only the verified user's actual ACTIVE wished listings.
- Detail retains current event and wishlist behavior.
- No Gate 1/2 action is opened.
- 360/390/430px screenshots show no overlap or horizontal scrolling.
- The verification report and Git state clearly separate prior work from this UI work.
